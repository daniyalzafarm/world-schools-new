import { Test, TestingModule } from '@nestjs/testing'
import { Prisma } from '../../../../generated/client/client'
import { PrismaService } from '../../../../prisma/prisma.service'
import { RedisService } from '../../../redis/redis.service'
import { ReimbursementsNotificationsService } from '../notifications/reimbursements-notifications.service'
import { ReimbursementsService } from '../reimbursements.service'
import { ReimbursementFollowupCron } from './reimbursement-followup.cron'

describe('ReimbursementFollowupCron', () => {
  let cron: ReimbursementFollowupCron
  let prisma: any
  let redis: any
  let reimbursements: any
  let notifications: any
  let redisClient: any

  function makeRow(overrides: Partial<any> = {}) {
    return {
      id: 'r-1',
      bookingGroupId: 'bg-1',
      amountOwed: new Prisma.Decimal('500.00'),
      currency: 'eur',
      dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      bookingGroup: {
        bookingGroupNumber: 'BG-0001',
        provider: {
          legalCompanyName: 'Cool Camp Ltd',
          owner: { firstName: 'Alex', email: 'alex@cool.test' },
        },
      },
      ...overrides,
    }
  }

  beforeEach(async () => {
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    }
    redis = { getClient: () => redisClient }
    prisma = { reimbursement: { findUnique: jest.fn() } }
    reimbursements = {
      findOverdueForReminder: jest.fn(),
      stampReminderSent: jest.fn().mockResolvedValue(undefined),
    }
    notifications = {
      notifyReimbursementReminder: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReimbursementFollowupCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ReimbursementsService, useValue: reimbursements },
        { provide: ReimbursementsNotificationsService, useValue: notifications },
      ],
    }).compile()
    cron = module.get(ReimbursementFollowupCron)
  })

  describe('Redis lock', () => {
    it('skips when lock is held by another instance', async () => {
      redisClient.set.mockResolvedValueOnce(null)
      await cron.run()
      expect(reimbursements.findOverdueForReminder).not.toHaveBeenCalled()
      expect(redisClient.del).not.toHaveBeenCalled()
    })

    it('releases the lock even if findOverdueForReminder throws', async () => {
      reimbursements.findOverdueForReminder.mockRejectedValueOnce(new Error('db down'))
      await expect(cron.run()).rejects.toThrow('db down')
      expect(redisClient.del).toHaveBeenCalledWith('cron:lock:reimbursement-followup')
    })
  })

  describe('runBatch', () => {
    it('returns zeros when no overdue rows', async () => {
      reimbursements.findOverdueForReminder.mockResolvedValueOnce([])
      const result = await cron.runBatch()
      expect(result).toEqual({ sent: 0, skipped: 0 })
      expect(notifications.notifyReimbursementReminder).not.toHaveBeenCalled()
    })

    it('sends + stamps when notification dispatches', async () => {
      reimbursements.findOverdueForReminder.mockResolvedValueOnce([makeRow()])
      // Status re-check at iteration time confirms still pending.
      prisma.reimbursement.findUnique.mockResolvedValueOnce({ status: 'pending' })
      notifications.notifyReimbursementReminder.mockResolvedValueOnce(true)

      const result = await cron.runBatch()

      expect(result).toEqual({ sent: 1, skipped: 0 })
      expect(notifications.notifyReimbursementReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          reimbursementId: 'r-1',
          bookingGroupNumber: 'BG-0001',
          amountOwedMajor: '500.00',
          providerOwnerEmail: 'alex@cool.test',
          providerOwnerFirstName: 'Alex',
        })
      )
      expect(reimbursements.stampReminderSent).toHaveBeenCalledWith('r-1')
    })

    it('does NOT stamp when notification returns false (no email on file, send error, etc.)', async () => {
      // The cooldown is intentionally left un-stamped so the cron retries
      // tomorrow — losing one reminder is recoverable, wrongly stamping
      // means the camp never hears from us.
      reimbursements.findOverdueForReminder.mockResolvedValueOnce([makeRow()])
      prisma.reimbursement.findUnique.mockResolvedValueOnce({ status: 'pending' })
      notifications.notifyReimbursementReminder.mockResolvedValueOnce(false)

      const result = await cron.runBatch()

      expect(result).toEqual({ sent: 0, skipped: 1 })
      expect(reimbursements.stampReminderSent).not.toHaveBeenCalled()
    })

    it('skips rows whose status changed mid-run (admin settled between query and iteration)', async () => {
      reimbursements.findOverdueForReminder.mockResolvedValueOnce([makeRow()])
      prisma.reimbursement.findUnique.mockResolvedValueOnce({ status: 'settled' })

      const result = await cron.runBatch()

      expect(result).toEqual({ sent: 0, skipped: 1 })
      expect(notifications.notifyReimbursementReminder).not.toHaveBeenCalled()
      expect(reimbursements.stampReminderSent).not.toHaveBeenCalled()
    })

    it('continues the batch when one notification throws', async () => {
      reimbursements.findOverdueForReminder.mockResolvedValueOnce([
        makeRow({ id: 'r-a' }),
        makeRow({ id: 'r-b' }),
      ])
      prisma.reimbursement.findUnique
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce({ status: 'pending' })
      notifications.notifyReimbursementReminder
        .mockRejectedValueOnce(new Error('SMTP down'))
        .mockResolvedValueOnce(true)

      const result = await cron.runBatch()

      expect(notifications.notifyReimbursementReminder).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ sent: 1, skipped: 1 })
      // Only the second row gets stamped.
      expect(reimbursements.stampReminderSent).toHaveBeenCalledWith('r-b')
      expect(reimbursements.stampReminderSent).not.toHaveBeenCalledWith('r-a')
    })
  })
})
