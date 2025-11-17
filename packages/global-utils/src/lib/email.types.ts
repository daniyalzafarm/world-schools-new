export interface EmailOptions {
  to: string
  subject: string
  html: string
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

