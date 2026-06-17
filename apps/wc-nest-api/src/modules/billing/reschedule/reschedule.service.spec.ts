import { Test, TestingModule } from '@nestjs/testing'
import { PaymentAuditEventType } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { CaptureSchedulerService } from '../captures/capture-scheduler.service'
import { PaymentAuditLogService } from '../shared/payment-audit-log.service'
import { RescheduleService } from './reschedule.service'

const NEW_START = new Date('2027-06-01T00:00:00.000Z')

function buildPlan() {
  return {
    bookingGroupId: 'bg-1',
    graceDeadline: new Date('2026-05-20T00:00:00.000Z'),
    currency: 'gbp',
    captureMode: 'two_stage',
    schedule: {
      captureMode: 'two_stage',
      events: [
        {
          sequence: 1,
          kind: 'balance',
          amount: 350,
          captureDate: new Date('2027-04-01T00:00:00.000Z'),
          effectiveCaptureDate: new Date('2027-04-01T00:00:00.000Z'),
        },
      ],
    },
    events: [],
    appFeePct: { toString: () => '15' },
    depositForConsentMajor: 600,
  }
}

describe('RescheduleService', () => {
  let service: RescheduleService
  let prisma: any
  let scheduler: any
  let audit: any

  beforeEach(async () => {
    prisma = {
      bookingGroup: { findUnique: jest.fn(), update: jest.fn() },
      rescheduleProposal: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'rp-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingConsentSnapshot: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    }
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma))
    scheduler = {
      planReschedule: jest.fn().mockResolvedValue(buildPlan()),
      writeRescheduleRows: jest.fn().mockResolvedValue(undefined),
      dispatchRescheduleRows: jest.fn().mockResolvedValue(0),
    }
    audit = { append: jest.fn(), appendSafe: jest.fn().mockResolvedValue(undefined) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescheduleService,
        { provide: PrismaService, useValue: prisma },
        { provide: CaptureSchedulerService, useValue: scheduler },
        { provide: PaymentAuditLogService, useValue: audit },
      ],
    }).compile()
    service = module.get(RescheduleService)
  })

  describe('propose', () => {
    const accepted = {
      id: 'bg-1',
      providerId: 'pr-1',
      status: 'deposit_paid',
      respondedAt: new Date('2026-05-21T00:00:00.000Z'),
      rescheduledStartDate: null,
      session: { startDate: new Date('2026-12-01T00:00:00.000Z') },
    }

    it('creates a pending proposal for an accepted booking owned by the provider', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(accepted)
      const res = await service.propose({
        providerId: 'pr-1',
        proposedByUserId: 'u-prov',
        bookingGroupId: 'bg-1',
        proposedStartDate: NEW_START,
      })
      expect(res.proposalId).toBe('rp-1')
      // Feasibility is validated up-front via the (read-only) plan.
      expect(scheduler.planReschedule).toHaveBeenCalledWith('bg-1', NEW_START)
      expect(prisma.rescheduleProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingGroupId: 'bg-1',
            proposedByUserId: 'u-prov',
            originalStartDate: accepted.session.startDate,
            proposedStartDate: NEW_START,
          }),
        })
      )
    })

    it('rejects when a pending proposal already exists', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(accepted)
      prisma.rescheduleProposal.findFirst.mockResolvedValueOnce({ id: 'existing' })
      await expect(
        service.propose({
          providerId: 'pr-1',
          proposedByUserId: 'u-prov',
          bookingGroupId: 'bg-1',
          proposedStartDate: NEW_START,
        })
      ).rejects.toThrow(/already awaiting/)
      expect(prisma.rescheduleProposal.create).not.toHaveBeenCalled()
    })

    it('rejects when the provider does not own the booking', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce({ ...accepted, providerId: 'other' })
      await expect(
        service.propose({
          providerId: 'pr-1',
          proposedByUserId: 'u-prov',
          bookingGroupId: 'bg-1',
          proposedStartDate: NEW_START,
        })
      ).rejects.toThrow(/does not belong/)
    })

    it('rejects a not-yet-accepted booking', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce({
        ...accepted,
        respondedAt: null,
        status: 'request',
      })
      await expect(
        service.propose({
          providerId: 'pr-1',
          proposedByUserId: 'u-prov',
          bookingGroupId: 'bg-1',
          proposedStartDate: NEW_START,
        })
      ).rejects.toThrow(/accepted, active booking/)
    })
  })

  describe('consent', () => {
    const owned = {
      id: 'bg-1',
      parent: { userId: 'u-parent' },
      camp: { depositEnabled: true },
    }

    it('recomputes, supersedes + re-captures consent, closes the proposal, and audits', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(owned)
      prisma.rescheduleProposal.findUnique.mockResolvedValueOnce({
        id: 'rp-1',
        bookingGroupId: 'bg-1',
        status: 'pending',
        proposedStartDate: NEW_START,
      })

      const res = await service.consent({
        bookingGroupId: 'bg-1',
        parentUserId: 'u-parent',
        proposalId: 'rp-1',
        ipAddress: '203.0.113.9',
        userAgent: 'jest',
        schemaVersion: 1,
      })

      expect(res).toEqual({ status: 'consented' })
      // Capture rows regenerated inside the transaction.
      expect(scheduler.writeRescheduleRows).toHaveBeenCalled()
      // Agreed new start recorded.
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rescheduledStartDate: NEW_START }),
        })
      )
      // Prior consent superseded, new one inserted with the customer's IP/UA.
      expect(prisma.bookingConsentSnapshot.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supersededAt: expect.any(Date) }),
        })
      )
      expect(prisma.bookingConsentSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ipAddress: '203.0.113.9' }) })
      )
      // Proposal closed.
      expect(prisma.rescheduleProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'consented' }) })
      )
      // Dispatched + audited after commit.
      expect(scheduler.dispatchRescheduleRows).toHaveBeenCalled()
      expect(audit.appendSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: PaymentAuditEventType.reschedule_recompute,
          bookingGroupId: 'bg-1',
        })
      )
    })

    it('rejects consent when there is no matching pending proposal', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(owned)
      prisma.rescheduleProposal.findUnique.mockResolvedValueOnce({
        id: 'rp-1',
        bookingGroupId: 'bg-1',
        status: 'declined',
        proposedStartDate: NEW_START,
      })
      await expect(
        service.consent({ bookingGroupId: 'bg-1', parentUserId: 'u-parent', proposalId: 'rp-1' })
      ).rejects.toThrow(/no pending reschedule/i)
      expect(scheduler.writeRescheduleRows).not.toHaveBeenCalled()
    })

    it('rejects consent from a non-owner', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce(owned)
      await expect(
        service.consent({
          bookingGroupId: 'bg-1',
          parentUserId: 'someone-else',
          proposalId: 'rp-1',
        })
      ).rejects.toThrow(/do not own/)
    })
  })

  describe('decline', () => {
    it('marks the proposal declined and takes NO financial action (original dates stand)', async () => {
      prisma.bookingGroup.findUnique.mockResolvedValueOnce({
        id: 'bg-1',
        parent: { userId: 'u-parent' },
        camp: { depositEnabled: true },
      })
      const res = await service.decline({
        bookingGroupId: 'bg-1',
        parentUserId: 'u-parent',
        proposalId: 'rp-1',
      })
      expect(res).toEqual({ status: 'declined' })
      expect(prisma.rescheduleProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'declined' }) })
      )
      // No recompute, no dispatch — the original schedule is untouched.
      expect(scheduler.writeRescheduleRows).not.toHaveBeenCalled()
      expect(scheduler.dispatchRescheduleRows).not.toHaveBeenCalled()
    })
  })
})
