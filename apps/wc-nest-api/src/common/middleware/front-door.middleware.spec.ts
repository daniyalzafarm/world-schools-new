import { Test, TestingModule } from '@nestjs/testing'
import { Request, Response } from 'express'
import { ConfigService } from '../../config/config.service'
import { FrontDoorMiddleware } from './front-door.middleware'

describe('FrontDoorMiddleware', () => {
  let middleware: FrontDoorMiddleware
  let configMock: { azureFdId: string }
  let next: jest.Mock
  let res: { status: jest.Mock; json: jest.Mock }

  beforeEach(async () => {
    configMock = { azureFdId: '' }
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FrontDoorMiddleware, { provide: ConfigService, useValue: configMock }],
    }).compile()
    middleware = moduleRef.get(FrontDoorMiddleware)
    next = jest.fn()
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
  })

  const reqWith = (path: string, fdHeader?: string): Request =>
    ({
      path,
      headers: fdHeader !== undefined ? { 'x-azure-fdid': fdHeader } : {},
    }) as unknown as Request

  it('passes through when AZURE_FDID is empty (dev/staging)', () => {
    middleware.use(reqWith('/anything'), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('passes through for /health even with no FD header (probe bypass)', () => {
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/health'), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when AZURE_FDID is set but the request has no header', () => {
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/api/users'), res as unknown as Response, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid Front Door identifier',
      statusCode: 403,
    })
  })

  it('returns 403 when X-Azure-FDID does not match', () => {
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/api/users', 'wrong-id'), res as unknown as Response, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('passes through when X-Azure-FDID matches', () => {
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/api/users', 'expected-fd-id'), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('passes through for Stripe webhooks when the header matches', () => {
    // Stripe → Front Door → CA. The header IS present on these requests.
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/stripe/webhooks', 'expected-fd-id'), res as unknown as Response, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('rejects Socket.io upgrades that arrive without a header', () => {
    configMock.azureFdId = 'expected-fd-id'
    middleware.use(reqWith('/socket.io/'), res as unknown as Response, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
