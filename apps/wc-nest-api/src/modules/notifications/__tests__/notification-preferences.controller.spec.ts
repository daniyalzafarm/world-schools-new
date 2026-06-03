import { HttpStatus } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { listCatalogEntries } from '../catalog/notification-catalog'
import {
  BulkPreferenceItemDto,
  BulkUpdatePreferencesDto,
  UserNotificationPreferencesController,
  _resetTemplateKeyCacheForTests,
} from '../preferences/notification-preferences.controller'
import { NotificationPreferencesService } from '../preferences/notification-preferences.service'
import { RedisService } from '../../redis/redis.service'

jest.mock('../catalog/notification-catalog', () => ({
  listCatalogEntries: jest.fn(),
}))

const mockedListCatalogEntries = listCatalogEntries as jest.MockedFunction<
  typeof listCatalogEntries
>

describe('UserNotificationPreferencesController — Phase 14c hardening', () => {
  let controller: UserNotificationPreferencesController
  let service: { listForUser: jest.Mock; bulkSetPreferences: jest.Mock }
  let redis: { isReady: jest.Mock; getClient: jest.Mock }
  let redisClient: { multi: jest.Mock }
  let multiChain: { incr: jest.Mock; expire: jest.Mock; exec: jest.Mock }

  beforeEach(async () => {
    service = {
      listForUser: jest.fn().mockResolvedValue([]),
      bulkSetPreferences: jest.fn().mockResolvedValue(0),
    }
    multiChain = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1]]),
    }
    redisClient = { multi: jest.fn().mockReturnValue(multiChain) }
    redis = {
      isReady: jest.fn().mockReturnValue(true),
      getClient: jest.fn().mockReturnValue(redisClient),
    }
    mockedListCatalogEntries.mockReset()
    _resetTemplateKeyCacheForTests()

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserNotificationPreferencesController],
      providers: [
        { provide: NotificationPreferencesService, useValue: service },
        { provide: RedisService, useValue: redis },
      ],
    }).compile()

    controller = module.get(UserNotificationPreferencesController)
  })

  describe('rate limiting (PATCH)', () => {
    const emptyDto = { items: [] } as unknown as BulkUpdatePreferencesDto

    it('allows updates while under the limit (count <= 30)', async () => {
      multiChain.exec.mockResolvedValueOnce([[null, 5]])
      const result = await controller.update('user-1', emptyDto)
      expect(result).toEqual({ success: true, updated: 0 })
      expect(service.bulkSetPreferences).toHaveBeenCalled()
    })

    it('throws 429 on the 31st request in a 60s window', async () => {
      multiChain.exec.mockResolvedValueOnce([[null, 31]])
      await expect(controller.update('user-1', emptyDto)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      })
      expect(service.bulkSetPreferences).not.toHaveBeenCalled()
    })

    it('soft-fails to "allow" when Redis is unreachable', async () => {
      redis.isReady.mockReturnValue(false)
      await expect(controller.update('user-1', emptyDto)).resolves.toEqual({
        success: true,
        updated: 0,
      })
    })

    it('soft-fails to "allow" when the Redis client throws', async () => {
      multiChain.exec.mockRejectedValueOnce(new Error('Redis timeout'))
      await expect(controller.update('user-1', emptyDto)).resolves.toEqual({
        success: true,
        updated: 0,
      })
    })

    it('sets EXPIRE so the counter window is 60 seconds', async () => {
      await controller.update('user-1', emptyDto)
      expect(multiChain.expire).toHaveBeenCalledWith(`rate:notif-prefs:user-1`, 60)
    })
  })

  describe('templateKey allow-list validator', () => {
    beforeEach(() => {
      mockedListCatalogEntries.mockReturnValue([
        { templateKey: 'parent.booking.accepted' } as never,
        { templateKey: 'parent.wishlist.priceDrop' } as never,
      ])
      _resetTemplateKeyCacheForTests()
    })

    async function buildDto(payload: Partial<BulkPreferenceItemDto>) {
      return plainToInstance(BulkPreferenceItemDto, payload)
    }

    it('passes validation for a registered templateKey', async () => {
      const dto = await buildDto({
        templateKey: 'parent.booking.accepted',
        channel: 'in_app',
        enabled: false,
      })
      const errors = await validate(dto)
      expect(errors).toEqual([])
    })

    it('rejects an unregistered templateKey (silent-drop is gone — clear 400)', async () => {
      const dto = await buildDto({
        templateKey: 'bogus.fake.key',
        channel: 'in_app',
        enabled: false,
      })
      const errors = await validate(dto)
      expect(errors).toHaveLength(1)
      expect(errors[0].constraints).toMatchObject({
        isCatalogTemplateKey: expect.stringContaining(
          'not a registered notification catalog entry'
        ),
      })
    })

    it('rejects an invalid channel value', async () => {
      const dto = await buildDto({
        templateKey: 'parent.booking.accepted',
        channel: 'sms' as never,
        enabled: false,
      })
      const errors = await validate(dto)
      expect(errors.some(e => e.property === 'channel')).toBe(true)
    })

    it('rejects a non-boolean enabled field', async () => {
      const dto = await buildDto({
        templateKey: 'parent.booking.accepted',
        channel: 'email',
        enabled: 'yes' as never,
      })
      const errors = await validate(dto)
      expect(errors.some(e => e.property === 'enabled')).toBe(true)
    })
  })
})
