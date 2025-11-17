# @world-schools/global-utils

Global utilities package for World Schools monorepo. This package contains shared utilities that can be used across all applications in the monorepo.

## Features

- **Email Service**: Send emails using nodemailer with support for HTML content and custom headers

## Installation

This package is part of the World Schools monorepo and is automatically available to all apps.

## Usage

### Email Service

```typescript
import { EmailService } from '@world-schools/global-utils'

// In your NestJS module
@Module({
  providers: [
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService],
})
export class YourModule {}

// In your service
constructor(private readonly emailService: EmailService) {}

async sendVerificationEmail(email: string, code: string) {
  await this.emailService.sendEmail({
    to: email,
    subject: 'Email Verification',
    html: `<p>Your verification code is: <strong>${code}</strong></p>`,
  })
}
```

