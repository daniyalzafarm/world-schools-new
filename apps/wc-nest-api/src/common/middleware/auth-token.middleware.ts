import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class AuthTokenMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authUsingRequest = this.configService.jwtConfig.authUsingRequest;
    if (authUsingRequest) {
      // Only set if present in headers
      if (req.headers['x-access-token']) {
        if (!req.cookies) req.cookies = {};
        req.cookies['accessToken'] = req.headers['x-access-token'] as string;
      }
      if (req.headers['x-refresh-token']) {
        if (!req.cookies) req.cookies = {};
        req.cookies['refreshToken'] = req.headers['x-refresh-token'] as string;
      }
    }
    next();
  }
}

