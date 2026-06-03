import { BadRequestException, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test, TestingModule } from '@nestjs/testing'
import { DisputeOutcome } from '../../../generated/client/enums'
import { PrismaService } from '../../../prisma/prisma.service'
import { StripeService } from '../../stripe/stripe.service'
import { DisputesService } from './disputes.service'

describe('DisputesService', () => {
  let service: DisputesService
  let prisma: any
  let stripe: any

  beforeEach(async () => {
    prisma = {
      payment: { findFirst: jest.fn() },
      dispute: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      bookingGroup: { update: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    stripe = {
      client: {
        disputes: { update: jest.fn() },
        files: { create: jest.fn() },
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StripeService, useValue: stripe },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()
    service = module.get(DisputesService)
  })

  describe('handleCreated', () => {
    it('inserts Dispute row and flags the BookingGroup as disputed', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce({ id: 'pay-1', bookingGroupId: 'bg-1' })

      await service.handleCreated({
        id: 'dp_1',
        amount: 60000,
        currency: 'eur',
        reason: 'fraudulent',
        status: 'needs_response',
        charge: 'ch_1',
        evidence_details: { due_by: 1735689600 }, // 2025-01-01 UTC
      } as never)

      expect(prisma.dispute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            stripeDisputeId: 'dp_1',
            paymentId: 'pay-1',
            bookingGroupId: 'bg-1',
            reason: 'fraudulent',
            outcome: DisputeOutcome.open,
          }),
        })
      )
      expect(prisma.bookingGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bg-1' }, data: { status: 'disputed' } })
      )
    })

    it('warns and returns when the Stripe charge does not match any Payment', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce(null)
      await service.handleCreated({
        id: 'dp_unknown',
        charge: 'ch_unknown',
        amount: 0,
        currency: 'eur',
        reason: 'general',
        status: 'needs_response',
      } as never)
      expect(prisma.dispute.upsert).not.toHaveBeenCalled()
    })
  })

  describe('handleClosed', () => {
    it('updates outcome to "lost" without creating Reimbursement (refund webhook path owns that)', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({
        id: 'd-1',
        bookingGroupId: 'bg-1',
        amount: 60000,
        currency: 'eur',
        status: 'needs_response',
      })

      await service.handleClosed({ id: 'dp_1', status: 'lost' } as never)

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ outcome: DisputeOutcome.lost }),
        })
      )
    })

    it('falls through to handleCreated when the dispute row is missing (out-of-order delivery)', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(null)
      prisma.payment.findFirst.mockResolvedValueOnce({ id: 'pay-1', bookingGroupId: 'bg-1' })

      await service.handleClosed({
        id: 'dp_2',
        amount: 60000,
        currency: 'eur',
        reason: 'fraudulent',
        status: 'needs_response',
        charge: 'ch_1',
      } as never)

      // Inserts via handleCreated path
      expect(prisma.dispute.upsert).toHaveBeenCalled()
    })
  })

  describe('handleFundsMovement', () => {
    it('stamps fundsWithdrawnAt on charge.dispute.funds_withdrawn', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({ id: 'd-1', bookingGroupId: 'bg-1' })

      await service.handleFundsMovement({ id: 'dp_1' } as never, 'withdrawn')

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd-1' },
          data: { fundsWithdrawnAt: expect.any(Date) },
        })
      )
    })

    it('stamps fundsReinstatedAt on charge.dispute.funds_reinstated', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({ id: 'd-1', bookingGroupId: 'bg-1' })

      await service.handleFundsMovement({ id: 'dp_1' } as never, 'reinstated')

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd-1' },
          data: { fundsReinstatedAt: expect.any(Date) },
        })
      )
    })

    it('warns and exits when the dispute row is unknown (out-of-order webhook)', async () => {
      // No dispute row in DB — likely the create webhook hasn't fired yet.
      // Don't crash; the create webhook will set the column when it arrives.
      prisma.dispute.findUnique.mockResolvedValueOnce(null)

      await service.handleFundsMovement({ id: 'dp_unknown' } as never, 'withdrawn')

      expect(prisma.dispute.update).not.toHaveBeenCalled()
    })
  })

  // ===== Phase 6: superadmin UI surface ===============================

  describe('listForAdmin', () => {
    it('paginates and orders by evidence deadline first, recency tie-break', async () => {
      prisma.dispute.findMany.mockResolvedValueOnce([{ id: 'd-1' }, { id: 'd-2' }])
      prisma.dispute.count.mockResolvedValueOnce(2)

      const result = await service.listForAdmin({
        outcome: DisputeOutcome.open,
        limit: 25,
        offset: 0,
      })

      expect(result).toEqual({
        rows: [{ id: 'd-1' }, { id: 'd-2' }],
        total: 2,
        limit: 25,
        offset: 0,
      })
      const findManyArgs = prisma.dispute.findMany.mock.calls[0][0]
      expect(findManyArgs.orderBy).toEqual([{ evidenceDueBy: 'asc' }, { createdAt: 'desc' }])
      expect(findManyArgs.where).toEqual({ outcome: { equals: DisputeOutcome.open } })
      expect(findManyArgs.take).toBe(25)
      expect(findManyArgs.skip).toBe(0)
    })

    it('clamps limit to [1, 200] and offset to ≥ 0', async () => {
      prisma.dispute.findMany.mockResolvedValueOnce([])
      prisma.dispute.count.mockResolvedValueOnce(0)

      await service.listForAdmin({ limit: 9999, offset: -5 })

      const findManyArgs = prisma.dispute.findMany.mock.calls[0][0]
      expect(findManyArgs.take).toBe(200)
      expect(findManyArgs.skip).toBe(0)
    })

    it('omits where clause when no outcome filter is provided', async () => {
      prisma.dispute.findMany.mockResolvedValueOnce([])
      prisma.dispute.count.mockResolvedValueOnce(0)

      await service.listForAdmin({})

      const findManyArgs = prisma.dispute.findMany.mock.calls[0][0]
      expect(findManyArgs.where).toEqual({})
    })

    it('supports an array of outcomes via prisma `in` clause', async () => {
      prisma.dispute.findMany.mockResolvedValueOnce([])
      prisma.dispute.count.mockResolvedValueOnce(0)

      await service.listForAdmin({ outcome: [DisputeOutcome.won, DisputeOutcome.lost] })

      const findManyArgs = prisma.dispute.findMany.mock.calls[0][0]
      expect(findManyArgs.where).toEqual({
        outcome: { in: [DisputeOutcome.won, DisputeOutcome.lost] },
      })
    })
  })

  describe('submitEvidence', () => {
    // Direct Charges: the dispute lives on the connected account. The service
    // reads `payment.stripeAccountId` from the joined `payment` relation to
    // route all Stripe API calls (file upload + dispute update) to the right
    // connected account.
    const STRIPE_ACCOUNT_ID = 'acct_provider_1'
    const baseDisputeRow = {
      id: 'd-1',
      stripeDisputeId: 'dp_live_1',
      status: 'needs_response',
      outcome: DisputeOutcome.open,
      bookingGroupId: 'bg-1',
      payment: { stripeAccountId: STRIPE_ACCOUNT_ID },
    }

    it('passes text fields straight to Stripe and refreshes local status', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(baseDisputeRow)
      stripe.client.disputes.update.mockResolvedValueOnce({
        id: 'dp_live_1',
        status: 'under_review',
      })
      // Race-safety pre-check inside the transaction: outcome still `open`,
      // so the update path runs.
      prisma.dispute.findUniqueOrThrow.mockResolvedValueOnce({ outcome: DisputeOutcome.open })
      prisma.dispute.update.mockResolvedValueOnce({ id: 'd-1', status: 'under_review' })

      await service.submitEvidence({
        disputeId: 'd-1',
        adminUserId: 'admin-1',
        submit: true,
        fields: {
          customer_communication: 'Booking confirmation emails sent on 2026-04-01',
          uncategorized_text: '   ', // whitespace-only — must be dropped
          product_description: 'Summer day camp, week of June 15',
        },
        fileUploads: [],
      })

      // Direct Charges: 3-arg signature with `stripeAccount` request option.
      expect(stripe.client.disputes.update).toHaveBeenCalledWith(
        'dp_live_1',
        {
          evidence: {
            customer_communication: 'Booking confirmation emails sent on 2026-04-01',
            product_description: 'Summer day camp, week of June 15',
          },
          submit: true,
        },
        { stripeAccount: STRIPE_ACCOUNT_ID }
      )
      // Local row sync after Stripe response moves status to under_review.
      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd-1' },
          data: { status: 'under_review', outcome: DisputeOutcome.open },
        })
      )
    })

    it('uploads files via files.create with purpose=dispute_evidence and attaches the returned id', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(baseDisputeRow)
      stripe.client.files.create.mockResolvedValueOnce({ id: 'file_abc' })
      stripe.client.disputes.update.mockResolvedValueOnce({
        id: 'dp_live_1',
        status: 'under_review',
      })
      prisma.dispute.findUniqueOrThrow.mockResolvedValueOnce({ outcome: DisputeOutcome.open })
      prisma.dispute.update.mockResolvedValueOnce({})

      await service.submitEvidence({
        disputeId: 'd-1',
        adminUserId: 'admin-1',
        submit: false,
        fields: {},
        fileUploads: [
          {
            field: 'service_documentation',
            filename: 'invoice.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('pdf-bytes'),
          },
        ],
      })

      // Direct Charges: file upload must go to the connected account.
      expect(stripe.client.files.create).toHaveBeenCalledWith(
        {
          purpose: 'dispute_evidence',
          file: {
            data: expect.any(Buffer),
            name: 'invoice.pdf',
            type: 'application/pdf',
          },
        },
        { stripeAccount: STRIPE_ACCOUNT_ID }
      )
      expect(stripe.client.disputes.update).toHaveBeenCalledWith(
        'dp_live_1',
        { evidence: { service_documentation: 'file_abc' }, submit: false },
        { stripeAccount: STRIPE_ACCOUNT_ID }
      )
    })

    it('rejects when the dispute is no longer open (terminal outcome)', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({
        ...baseDisputeRow,
        outcome: DisputeOutcome.lost,
      })

      await expect(
        service.submitEvidence({
          disputeId: 'd-1',
          adminUserId: 'admin-1',
          submit: true,
          fields: { customer_name: 'Ada' },
          fileUploads: [],
        })
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(stripe.client.disputes.update).not.toHaveBeenCalled()
    })

    it('rejects unknown text fields (defense — controller passes a fixed allow-list, but service is the source of truth)', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(baseDisputeRow)

      await expect(
        service.submitEvidence({
          disputeId: 'd-1',
          adminUserId: 'admin-1',
          submit: false,
          fields: { not_a_real_field: 'x' } as never,
          fileUploads: [],
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('rejects file uploads targeting a text-only evidence slot', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(baseDisputeRow)

      await expect(
        service.submitEvidence({
          disputeId: 'd-1',
          adminUserId: 'admin-1',
          submit: false,
          fields: {},
          fileUploads: [
            {
              field: 'customer_name', // text field — rejected
              filename: 'x.pdf',
              mimetype: 'application/pdf',
              buffer: Buffer.from('x'),
            },
          ],
        })
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(stripe.client.files.create).not.toHaveBeenCalled()
    })

    it('throws NotFoundException for an unknown dispute id', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.submitEvidence({
          disputeId: 'missing',
          adminUserId: 'admin-1',
          submit: false,
          fields: {},
          fileUploads: [],
        })
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it('Phase-6 audit: webhook-race guard — does NOT downgrade outcome that has gone terminal between Stripe call and DB update', async () => {
      // Pre-check at start of submitEvidence reads `open`.
      prisma.dispute.findUnique.mockResolvedValueOnce(baseDisputeRow)
      // Stripe responds with `under_review` (success, evidence accepted).
      stripe.client.disputes.update.mockResolvedValueOnce({
        id: 'dp_live_1',
        status: 'under_review',
      })
      // BUT in between, a `charge.dispute.closed` webhook arrived and flipped
      // the local row to `lost`. The transaction's findUniqueOrThrow sees that.
      prisma.dispute.findUniqueOrThrow.mockResolvedValueOnce({ outcome: DisputeOutcome.lost })
      // The fallback path re-reads the row (terminal) for the response.
      prisma.dispute.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'd-1',
        outcome: DisputeOutcome.lost,
      })

      const result = await service.submitEvidence({
        disputeId: 'd-1',
        adminUserId: 'admin-1',
        submit: true,
        fields: { customer_communication: 'Logs attached' },
        fileUploads: [],
      })

      // Crucial: we did NOT call `update`, because that would have overwritten
      // `outcome=lost` back to `open` and lost the webhook truth.
      expect(prisma.dispute.update).not.toHaveBeenCalled()
      expect(result.outcome).toBe(DisputeOutcome.lost)
    })
  })

  describe('recordOutcomeOverride', () => {
    it('updates outcome to the provided value and stamps audit', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({
        id: 'd-1',
        stripeDisputeId: 'dp_live_1',
        bookingGroupId: 'bg-1',
        outcome: DisputeOutcome.open,
      })
      prisma.dispute.update.mockResolvedValueOnce({ id: 'd-1', outcome: DisputeOutcome.lost })

      await service.recordOutcomeOverride({
        disputeId: 'd-1',
        outcome: DisputeOutcome.lost,
        note: 'Stripe webhook stuck for 48h; matched bank statement.',
        adminUserId: 'admin-1',
      })

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd-1' },
          data: { outcome: DisputeOutcome.lost },
        })
      )
    })

    it('rejects override outcome=open (overrides exist to close stuck disputes, not reopen)', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce({
        id: 'd-1',
        stripeDisputeId: 'dp_live_1',
        bookingGroupId: 'bg-1',
        outcome: DisputeOutcome.lost,
      })

      await expect(
        service.recordOutcomeOverride({
          disputeId: 'd-1',
          outcome: DisputeOutcome.open,
          adminUserId: 'admin-1',
        })
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws NotFoundException for an unknown dispute id', async () => {
      prisma.dispute.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.recordOutcomeOverride({
          disputeId: 'missing',
          outcome: DisputeOutcome.won,
          adminUserId: 'admin-1',
        })
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
