import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '../../../config/config.service'
import { StripeService } from '../stripe.service'
import { StripeWebhookController } from './stripe-webhook.controller'
import { StripeWebhookService } from './stripe-webhook.service'

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController
  let stripe: { client: { webhooks: { constructEvent: jest.Mock } } }
  let webhookService: { processEvent: jest.Mock }
  let configService: { stripeConfig: { webhookSecret: string; webhookToleranceSeconds: number } }

  const validSignature = 't=123,v1=abc'
  const rawBody = Buffer.from('{"id":"evt_test"}')

  beforeEach(async () => {
    stripe = {
      client: {
        webhooks: {
          constructEvent: jest.fn(),
        },
      },
    }
    webhookService = { processEvent: jest.fn() }
    configService = {
      stripeConfig: { webhookSecret: 'whsec_test', webhookToleranceSeconds: 600 },
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: StripeService, useValue: stripe },
        { provide: StripeWebhookService, useValue: webhookService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    controller = module.get(StripeWebhookController)
  })

  function makeReq(body: Buffer | undefined): RawBodyRequest<Request> {
    return { rawBody: body } as unknown as RawBodyRequest<Request>
  }

  describe('handleWebhook', () => {
    it('throws 400 BadRequestException when raw body is missing', async () => {
      // Without `rawBody: true` in main.ts, the controller can't construct the
      // event — surface this loudly so misconfigured deploys fail fast instead
      // of silently 401ing every Stripe delivery.
      await expect(controller.handleWebhook(makeReq(undefined), validSignature)).rejects.toThrow(
        BadRequestException
      )
      await expect(controller.handleWebhook(makeReq(undefined), validSignature)).rejects.toThrow(
        'Missing raw body'
      )
      expect(stripe.client.webhooks.constructEvent).not.toHaveBeenCalled()
      expect(webhookService.processEvent).not.toHaveBeenCalled()
    })

    it('throws 400 BadRequestException with a generic message when signature is invalid', async () => {
      // The error message returned to Stripe MUST NOT echo the raw signature
      // verification message — that can include token-like fragments. The
      // controller maps every signature failure to a generic "Invalid
      // signature" string so retries surface in the Stripe dashboard.
      stripe.client.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      await expect(controller.handleWebhook(makeReq(rawBody), 't=bogus,v1=bad')).rejects.toThrow(
        BadRequestException
      )
      await expect(controller.handleWebhook(makeReq(rawBody), 't=bogus,v1=bad')).rejects.toThrow(
        'Invalid signature'
      )

      expect(webhookService.processEvent).not.toHaveBeenCalled()
    })

    it('passes the configured tolerance to constructEvent', async () => {
      // H4: ops-driven tolerance must reach the SDK call.
      stripe.client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'account.updated',
      })
      webhookService.processEvent.mockResolvedValue(undefined)

      await controller.handleWebhook(makeReq(rawBody), validSignature)

      expect(stripe.client.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        validSignature,
        'whsec_test',
        600
      )
    })

    it('dispatches verified events to the webhook service', async () => {
      const event = { id: 'evt_2', type: 'payment_intent.succeeded' }
      stripe.client.webhooks.constructEvent.mockReturnValue(event)
      webhookService.processEvent.mockResolvedValue(undefined)

      await controller.handleWebhook(makeReq(rawBody), validSignature)

      expect(webhookService.processEvent).toHaveBeenCalledWith(event)
    })

    it('propagates handler errors as 5xx so Stripe retries', async () => {
      // The contract: any error from `processEvent` must propagate. NestJS
      // turns uncaught throws into 500s, which is exactly what we want —
      // Stripe retries until we mark the event processed.
      stripe.client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_3',
        type: 'account.updated',
      })
      const handlerErr = new Error('boom')
      webhookService.processEvent.mockRejectedValue(handlerErr)

      await expect(controller.handleWebhook(makeReq(rawBody), validSignature)).rejects.toBe(
        handlerErr
      )
    })

    it('returns void (HTTP 200) on the happy path', async () => {
      stripe.client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_4',
        type: 'account.updated',
      })
      webhookService.processEvent.mockResolvedValue(undefined)

      // The decorator on the route already locks the status to 200; the unit
      // test asserts the method resolves without a payload.
      await expect(
        controller.handleWebhook(makeReq(rawBody), validSignature)
      ).resolves.toBeUndefined()
    })
  })
})
