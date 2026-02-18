import { Injectable, Logger } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import { EmailOptions, EmailConfig } from './email.types'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter

  constructor(private readonly emailConfig: EmailConfig) {
    this.initializeTransporter()
  }

  private initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: this.emailConfig.user,
        pass: this.emailConfig.pass,
      },
    })
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions: any = {
        from: options.from ?? this.emailConfig.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }

      // Add unique Message-ID if provided
      if (options.messageId) {
        mailOptions.messageId = options.messageId
      }

      // Add headers to prevent email collapse
      mailOptions.headers = {
        'X-Entity-Ref-ID': options.messageId ?? `entity-${Date.now()}`,
        'X-Priority': '3', // Normal priority
        'X-MSMail-Priority': 'Normal',
        Importance: 'normal',
        'X-Mailer': 'World Schools System',
      }

      const info = await this.transporter.sendMail(mailOptions)
      this.logger.log(`Email sent successfully: ${info.messageId}`)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Failed to send email: ${errorMessage}`, errorStack)
      return false
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      this.logger.log('Email service connection verified')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Email service connection failed: ${errorMessage}`)
      return false
    }
  }
}
