import { Test, TestingModule } from '@nestjs/testing'
import { EmailService } from '@world-schools/global-utils'
import { Prisma } from '../../../../generated/client/client'
import { ConfigService } from '../../../../config/config.service'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'
import { StripeService } from '../../../stripe/stripe.service'
import { BillingPaymentNotificationsService } from './billing-payment-notifications.service'

describe('BillingPaymentNotificationsService', () => {
  let service: BillingPaymentNotificationsService
  let prisma: any
  let emailService: any
  let emailTemplate: any
  let config: any
  let stripeService: any

  function makePaymentRow(overrides: Partial<any> = {}) {
    return {
      id: 'pay-1',
      stripePaymentIntentId: 'pi_1',
      // Direct Charges: the intent lives on the connected account; the service
      // reads this to add the `Stripe-Account` request option to the retrieve.
      stripeAccountId: 'acct_provider',
      amount: new Prisma.Decimal('1400.00'),
      currency: 'eur',
      bookingGroup: {
        bookingGroupNumber: 'BG-0001',
        camp: { name: 'Cool Camp' },
        parent: {
          user: { email: 'parent@example.com', firstName: 'Ada' },
        },
      },
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = { payment: { findUnique: jest.fn() } }
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) }
    emailTemplate = {
      getOffSession3dsRecoveryTemplate: jest.fn().mockReturnValue('<html>recovery</html>'),
      getPaymentFailedFinalTemplate: jest.fn().mockReturnValue('<html>failure</html>'),
    }
    config = { bookingPortalUrl: 'https://booking.test' }
    stripeService = {
      client: {
        paymentIntents: {
          retrieve: jest.fn(),
        },
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingPaymentNotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: EmailTemplateService, useValue: emailTemplate },
        { provide: ConfigService, useValue: config },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compile()
    service = module.get(BillingPaymentNotificationsService)
  })

  describe('notifyOffSessionRequiresAction', () => {
    it('retrieves a fresh client_secret, builds the recovery URL, and sends the email', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(makePaymentRow())
      stripeService.client.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 'pi_1_secret_xyz',
      })

      await service.notifyOffSessionRequiresAction('pay-1')

      // We retrieve fresh (not cached on the row) — Stripe rotates the
      // client_secret on certain transitions and a stale value fails.
      // Direct Charges: the retrieve is scoped to the connected account via
      // the 3rd-arg `stripeAccount` request option.
      expect(stripeService.client.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1', undefined, {
        stripeAccount: 'acct_provider',
      })
      // The recovery URL drops the parent on /payment/authorize with the
      // client_secret URL-encoded so handleNextAction can pick it up. The
      // page initializes Stripe.js with the embedded `stripe_account` so it
      // can call `retrievePaymentIntent` against the connected account.
      expect(emailTemplate.getOffSession3dsRecoveryTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentFirstName: 'Ada',
          campName: 'Cool Camp',
          bookingGroupNumber: 'BG-0001',
          recoveryUrl:
            'https://booking.test/payment/authorize?payment_intent_client_secret=pi_1_secret_xyz&stripe_account=acct_provider',
        })
      )
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'parent@example.com',
          html: '<html>recovery</html>',
        })
      )
    })

    it('warns and returns when the Payment row is missing or has no intent id', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(null)

      await service.notifyOffSessionRequiresAction('pay-missing')

      expect(stripeService.client.paymentIntents.retrieve).not.toHaveBeenCalled()
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    it('warns and returns when the parent has no email address', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(
        makePaymentRow({
          bookingGroup: {
            bookingGroupNumber: 'BG-0001',
            camp: { name: 'Cool Camp' },
            parent: { user: { email: null, firstName: 'Ada' } },
          },
        })
      )

      await service.notifyOffSessionRequiresAction('pay-1')

      expect(stripeService.client.paymentIntents.retrieve).not.toHaveBeenCalled()
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    it('catches Stripe retrieve failures and skips the send (best-effort)', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(makePaymentRow())
      stripeService.client.paymentIntents.retrieve.mockRejectedValueOnce(new Error('Stripe down'))

      await expect(service.notifyOffSessionRequiresAction('pay-1')).resolves.toBeUndefined()
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    it('catches sendEmail failures so a notification hiccup never aborts the cron', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(makePaymentRow())
      stripeService.client.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: 'pi_1_secret_xyz',
      })
      emailService.sendEmail.mockRejectedValueOnce(new Error('SMTP down'))

      await expect(service.notifyOffSessionRequiresAction('pay-1')).resolves.toBeUndefined()
    })

    it('skips when the retrieved intent has no client_secret', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(makePaymentRow())
      stripeService.client.paymentIntents.retrieve.mockResolvedValueOnce({
        id: 'pi_1',
        client_secret: null,
      })

      await service.notifyOffSessionRequiresAction('pay-1')
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })
  })

  describe('notifyPaymentFailedFinal', () => {
    it('renders the failure template and sends to the parent', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(makePaymentRow())

      await service.notifyPaymentFailedFinal('pay-1')

      expect(emailTemplate.getPaymentFailedFinalTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentFirstName: 'Ada',
          campName: 'Cool Camp',
          bookingGroupNumber: 'BG-0001',
          bookingsUrl: 'https://booking.test/bookings',
        })
      )
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'parent@example.com',
          html: '<html>failure</html>',
        })
      )
    })

    it('warns and returns on missing payment or missing email', async () => {
      prisma.payment.findUnique.mockResolvedValueOnce(null)
      await service.notifyPaymentFailedFinal('pay-missing')
      expect(emailService.sendEmail).not.toHaveBeenCalled()

      prisma.payment.findUnique.mockResolvedValueOnce(
        makePaymentRow({
          bookingGroup: {
            bookingGroupNumber: 'BG-1',
            camp: { name: 'Camp' },
            parent: { user: { email: null, firstName: 'Ada' } },
          },
        })
      )
      await service.notifyPaymentFailedFinal('pay-noemail')
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })
  })
})
