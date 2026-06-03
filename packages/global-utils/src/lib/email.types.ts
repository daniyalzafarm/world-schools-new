export interface EmailOptions {
  to: string
  subject: string
  html: string
  /** Plain-text alternative for multi-part MIME. Improves Gmail/Outlook
   *  deliverability scoring and lets text-only clients read the message. */
  text?: string
  from?: string
  messageId?: string
}

export interface EmailConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}
