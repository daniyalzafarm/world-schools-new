import { Injectable } from '@nestjs/common'

@Injectable()
export class HealthService {
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'unknown',
    }
  }
}
