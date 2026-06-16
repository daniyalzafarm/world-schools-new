import { Test, TestingModule } from '@nestjs/testing'
import { PaymentAuditEventType } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { PaymentAuditLogService } from './payment-audit-log.service'

describe('PaymentAuditLogService', () => {
  let service: PaymentAuditLogService
  let prisma: { bookingPaymentAuditLog: { create: jest.Mock } }

  beforeEach(async () => {
    prisma = { bookingPaymentAuditLog: { create: jest.fn().mockResolvedValue({}) } }
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentAuditLogService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = module.get(PaymentAuditLogService)
  })

  const base = { actor: 'admin:1', bookingGroupId: 'bg-1' }

  describe('reasonText enforcement for privileged events', () => {
    it.each([PaymentAuditEventType.admin_override, PaymentAuditEventType.force_majeure_action])(
      'append() throws when %s has no reasonText',
      async eventType => {
        await expect(service.append({ ...base, eventType })).rejects.toThrow(
          /reasonText is required/
        )
        expect(prisma.bookingPaymentAuditLog.create).not.toHaveBeenCalled()
      }
    )

    it.each([PaymentAuditEventType.admin_override, PaymentAuditEventType.force_majeure_action])(
      'append() throws when %s reasonText is whitespace-only',
      async eventType => {
        await expect(service.append({ ...base, eventType, reasonText: '   ' })).rejects.toThrow(
          /reasonText is required/
        )
      }
    )

    it('append() writes the row when a privileged event has a reason', async () => {
      await service.append({
        ...base,
        eventType: PaymentAuditEventType.admin_override,
        reasonText: 'resolved: refunded',
      })
      expect(prisma.bookingPaymentAuditLog.create).toHaveBeenCalledTimes(1)
    })

    it('append() allows a non-privileged event without a reason', async () => {
      await service.append({ ...base, eventType: PaymentAuditEventType.balance_capture_fired })
      expect(prisma.bookingPaymentAuditLog.create).toHaveBeenCalledTimes(1)
    })

    it('appendSafe() throws a contract violation loudly (not swallowed)', async () => {
      await expect(
        service.appendSafe({ ...base, eventType: PaymentAuditEventType.force_majeure_action })
      ).rejects.toThrow(/reasonText is required/)
      expect(prisma.bookingPaymentAuditLog.create).not.toHaveBeenCalled()
    })
  })

  describe('appendSafe() infrastructure failures', () => {
    it('swallows a DB error and does not throw', async () => {
      prisma.bookingPaymentAuditLog.create.mockRejectedValueOnce(new Error('db down'))
      await expect(
        service.appendSafe({ ...base, eventType: PaymentAuditEventType.balance_capture_failed })
      ).resolves.toBeUndefined()
    })
  })
})
