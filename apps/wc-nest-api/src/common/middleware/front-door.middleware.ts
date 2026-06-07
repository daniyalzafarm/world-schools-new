import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { ConfigService } from '../../config/config.service'

@Injectable()
export class FrontDoorMiddleware implements NestMiddleware {
  private readonly logger = new Logger(FrontDoorMiddleware.name)

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const expected = this.configService.azureFdId

    // Dev/staging environments do not set AZURE_FDID — skip enforcement so the
    // app stays runnable outside Front Door. Production is required to set it.
    if (!expected) {
      return next()
    }

    // Container Apps Liveness/Readiness/Startup probes hit /health on the pod's
    // internal IP, not through Front Door, so they cannot carry X-Azure-FDID.
    // Letting probes through is required to keep revisions healthy.
    if (req.path === '/health') {
      return next()
    }

    if (req.headers['x-azure-fdid'] !== expected) {
      this.logger.warn(
        `Rejected request without valid X-Azure-FDID. path=${req.path} actual=${
          req.headers['x-azure-fdid'] ?? '(missing)'
        }`
      )
      res.status(403).json({
        success: false,
        message: 'Invalid Front Door identifier',
        statusCode: 403,
      })
      return
    }

    next()
  }
}
