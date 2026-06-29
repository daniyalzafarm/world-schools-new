import { Injectable } from '@nestjs/common'
import { formatSnakeCaseToTitleCase } from '@world-schools/wc-utils/backend'

/**
 * Email Template Service
 * Provides reusable email templates with consistent branding and theme colors
 */
@Injectable()
export class EmailTemplateService {
  // Theme colors from frontend applications
  private readonly colors = {
    primary: '#45f0b5', // Teal/Green
    primaryDark: '#22c192',
    secondary: '#07153d', // Dark Navy
    success: '#23874e',
    warning: '#936316',
    danger: '#c20e4d',
    background: '#ffffff',
    backgroundGray: '#f9f9f9',
    textPrimary: '#07153d',
    textSecondary: '#666666',
    border: '#e5e5e5',
  }

  // Logo URL
  private readonly logoUrl =
    'https://files.staging.world-camps.org/wc-booking-system/favicon-world-camps.png'

  /**
   * Minimal HTML entity escape for template params that come from user
   * input (parent first name, camp name, booking number). Prevents broken
   * markup or stored-XSS-via-email when, e.g., a provider names a camp
   * `My <script>...</script> Camp`. Not applied to URL params or
   * server-generated values like `Intl.NumberFormat`-formatted amounts.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Get base email template with consistent styling
   */
  private getBaseTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>World-Camps</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: ${this.colors.textPrimary};
              background-color: ${this.colors.backgroundGray};
            }
            .email-wrapper {
              width: 100%;
              background-color: ${this.colors.backgroundGray};
              padding: 40px 20px;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: ${this.colors.background};
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            }
            .email-header {
              background: linear-gradient(135deg, ${this.colors.secondary} 0%, ${this.colors.primaryDark} 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .email-header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .email-header .logo {
              font-size: 32px;
              font-weight: 800;
              margin-bottom: 10px;
              color: ${this.colors.primary};
            }
            .email-body {
              padding: 40px 30px;
            }
            .email-footer {
              background-color: ${this.colors.backgroundGray};
              padding: 30px;
              text-align: center;
              font-size: 13px;
              color: ${this.colors.textSecondary};
              border-top: 1px solid ${this.colors.border};
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background-color: ${this.colors.primary};
              color: ${this.colors.secondary};
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              margin: 20px 0;
              transition: background-color 0.2s;
            }
            .button:hover {
              background-color: ${this.colors.primaryDark};
            }
            .info-box {
              background-color: ${this.colors.backgroundGray};
              border-left: 4px solid ${this.colors.primary};
              padding: 16px 20px;
              margin: 20px 0;
              border-radius: 6px;
            }
            .warning-box {
              background-color: #fdedd3;
              border-left: 4px solid ${this.colors.warning};
              padding: 16px 20px;
              margin: 20px 0;
              border-radius: 6px;
            }
            .success-box {
              background-color: #d1f4e0;
              border-left: 4px solid ${this.colors.success};
              padding: 16px 20px;
              margin: 20px 0;
              border-radius: 6px;
            }
            .danger-box {
              background-color: #fdd0df;
              border-left: 4px solid ${this.colors.danger};
              padding: 16px 20px;
              margin: 20px 0;
              border-radius: 6px;
            }
            h2 {
              color: ${this.colors.textPrimary};
              font-size: 22px;
              margin-top: 0;
              margin-bottom: 16px;
            }
            p {
              margin: 12px 0;
              color: ${this.colors.textPrimary};
            }
            .text-secondary {
              color: ${this.colors.textSecondary};
            }
            .divider {
              height: 1px;
              background-color: ${this.colors.border};
              margin: 30px 0;
            }
            @media only screen and (max-width: 600px) {
              .email-wrapper {
                padding: 20px 10px;
              }
              .email-header, .email-body, .email-footer {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              ${content}
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Get email verification template
   */
  getVerificationEmailTemplate(
    code: string,
    expiryMinutes: number,
    userName: string,
    verificationUrl: string,
    audience: 'parent' | 'provider'
  ): string {
    const safeUserName = this.escapeHtml(userName)
    const intro =
      audience === 'provider'
        ? "Thank you for joining World Camps as a camp provider. We're excited to help you connect with families from around the world looking for amazing camp experiences."
        : "Thank you for joining World Camps. We're excited to help you discover and book amazing camp experiences for your family."
    const verifyLine =
      audience === 'provider'
        ? 'Please verify your email address to complete your registration and start setting up your camp profile.'
        : 'Please verify your email address to complete your registration and start exploring camps.'
    const supportEmail =
      audience === 'provider' ? 'providers@world-camps.com' : 'support@world-camps.com'
    const supportLabel =
      audience === 'provider' ? 'Contact our provider support team' : 'Contact our support team'
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Welcome to World Camps</title>
    </head>
    <body style="margin:0;padding:0;background-color:${this.colors.backgroundGray};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${this.colors.backgroundGray};">
    <tr>
    <td align="center" style="padding:40px 24px;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${this.colors.background};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <!-- Header -->
    <tr>
    <td style="padding:32px 48px;border-bottom:1px solid ${this.colors.border};">
    <img src="${this.logoUrl}" alt="World Camps" width="40" height="40" style="display:block;border-radius:50%;">
    </td>
    </tr>

    <!-- Content -->
    <tr>
    <td style="padding:48px;">

    <h1 style="margin:0 0 24px 0;font-size:26px;font-weight:700;color:${this.colors.textPrimary};line-height:1.3;">
    Welcome to World Camps!
    </h1>

    <p style="margin:0 0 16px 0;font-size:16px;color:${this.colors.textSecondary};line-height:1.7;">
    Hi ${safeUserName},
    </p>

    <p style="margin:0 0 16px 0;font-size:16px;color:${this.colors.textSecondary};line-height:1.7;">
    ${intro}
    </p>

    <p style="margin:0 0 32px 0;font-size:16px;color:${this.colors.textSecondary};line-height:1.7;">
    ${verifyLine}
    </p>

    <!-- Button -->
    <table cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td style="padding-bottom:32px;">
    <a href="${verificationUrl}" style="display:inline-block;padding:14px 32px;background-color:${this.colors.primary};border-radius:8px;text-decoration:none;">
    <span style="font-size:15px;font-weight:600;color:${this.colors.secondary};">Verify Email Address</span>
    </a>
    </td>
    </tr>
    </table>

    <p style="margin:0 0 16px 0;font-size:14px;color:${this.colors.textSecondary};line-height:1.6;">
    Or enter this verification code:
    </p>

    <!-- Code -->
    <table cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td>
    <div style="display:inline-block;padding:16px 32px;background-color:${this.colors.backgroundGray};border-radius:8px;border:1px solid ${this.colors.border};">
    <span style="font-size:28px;font-weight:700;color:${this.colors.textPrimary};letter-spacing:4px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,Monaco,monospace;">${code}</span>
    </div>
    </td>
    </tr>
    </table>

    <p style="margin:24px 0 0 0;font-size:14px;color:${this.colors.textSecondary};line-height:1.6;">
    This link and code will expire in <strong style="color:${this.colors.textPrimary};">${expiryMinutes} minutes</strong>.
    </p>

    </td>
    </tr>

    <!-- Divider -->
    <tr>
    <td style="padding:0 48px;">
    <div style="height:1px;background-color:${this.colors.border};"></div>
    </td>
    </tr>

    <!-- Help -->
    <tr>
    <td style="padding:24px 48px;">
    <p style="margin:0;font-size:14px;color:${this.colors.textSecondary};line-height:1.6;">
    If you didn't create an account, you can safely ignore this email.
    </p>
    <p style="margin:12px 0 0 0;font-size:14px;color:${this.colors.textSecondary};line-height:1.6;">
    Have questions? <a href="mailto:${supportEmail}" style="color:${this.colors.primary};text-decoration:none;font-weight:500;">${supportLabel}</a>
    </p>
    </td>
    </tr>

    <!-- Footer -->
    <tr>
    <td style="background-color:${this.colors.secondary};padding:32px 48px;">
    <table cellpadding="0" cellspacing="0" border="0">
    <tr>
    <td style="vertical-align:middle;">
    <img src="${this.logoUrl}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:50%;">
    <span style="font-size:15px;font-weight:600;color:#ffffff;margin-left:10px;vertical-align:middle;">World Camps</span>
    </td>
    </tr>
    </table>

    <p style="margin:20px 0 0 0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">
    © ${new Date().getFullYear()} World Camps. All rights reserved.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
    <tr>
    <td><a href="https://world-camps.com/help" style="font-size:13px;color:rgba(255,255,255,0.6);text-decoration:none;">Help Center</a></td>
    <td style="padding:0 16px;color:rgba(255,255,255,0.3);">|</td>
    <td><a href="https://world-camps.com/privacy" style="font-size:13px;color:rgba(255,255,255,0.6);text-decoration:none;">Privacy Policy</a></td>
    <td style="padding:0 16px;color:rgba(255,255,255,0.3);">|</td>
    <td><a href="https://world-camps.com/terms" style="font-size:13px;color:rgba(255,255,255,0.6);text-decoration:none;">Terms of Service</a></td>
    </tr>
    </table>
    </td>
    </tr>

    </table>

    </td>
    </tr>
    </table>

    </body>
    </html>`
  }

  /**
   * Get application submitted confirmation template
   */
  getApplicationSubmittedTemplate(params: {
    providerName: string
    applicationId: string
    submittedDate: string
  }): string {
    const providerName = this.escapeHtml(params.providerName)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Application Received</h1>
      </div>
      <div class="email-body">
        <h2>Thank you for your application!</h2>
        <p>Dear ${providerName},</p>
        <p>We have successfully received your provider application for World-Camps. Your application is now under review by our team.</p>

        <div class="success-box">
          <p style="margin: 0;"><strong>Application Reference:</strong> ${params.applicationId}</p>
          <p style="margin: 8px 0 0 0;"><strong>Submitted:</strong> ${params.submittedDate}</p>
        </div>

        <h2>What happens next?</h2>
        <p>Our team will carefully review your application, which typically takes 3-5 business days. We will:</p>
        <ul style="color: ${this.colors.textPrimary}; line-height: 1.8;">
          <li>Verify your business information and credentials</li>
          <li>Review your program offerings and facilities</li>
          <li>Assess your safety and quality standards</li>
          <li>Check all required documentation</li>
        </ul>

        <div class="info-box">
          <p style="margin: 0;"><strong>💡 Tip:</strong> You will receive an email notification once your application has been reviewed. Please ensure this email address is added to your safe senders list.</p>
        </div>

        <p>If we need any additional information, we'll reach out to you directly.</p>
        <p>Thank you for your interest in partnering with World-Camps!</p>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">If you have any questions, please contact our support team.</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Get application approved welcome template
   */
  getApplicationApprovedTemplate(params: {
    providerName: string
    loginUrl: string
    contactEmail: string
  }): string {
    const providerName = this.escapeHtml(params.providerName)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>🎉 Welcome to World-Camps!</h1>
      </div>
      <div class="email-body">
        <h2>Congratulations! Your application has been approved</h2>
        <p>Dear ${providerName},</p>
        <p>We're thrilled to inform you that your provider application has been approved! Welcome to the World-Camps community.</p>

        <div class="success-box">
          <p style="margin: 0; font-size: 16px;"><strong>✅ Your account is now active!</strong></p>
        </div>

        <h2>Get Started</h2>
        <p>You can now access your provider dashboard and start managing your programs:</p>

        <div style="text-align: center;">
          <a href="${params.loginUrl}" class="button">Access Your Dashboard</a>
        </div>

        <h2>Next Steps</h2>
        <ul style="color: ${this.colors.textPrimary}; line-height: 1.8;">
          <li><strong>Complete your profile:</strong> Add detailed information about your programs and facilities</li>
          <li><strong>Upload media:</strong> Showcase your camps with photos and videos</li>
          <li><strong>Set availability:</strong> Configure your program schedules and pricing</li>
          <li><strong>Review settings:</strong> Ensure your contact information and preferences are up to date</li>
        </ul>

        <div class="info-box">
          <p style="margin: 0;"><strong>Need help getting started?</strong></p>
          <p style="margin: 8px 0 0 0;">Check out our provider guide or contact us at <a href="mailto:${params.contactEmail}" style="color: ${this.colors.primary};">${params.contactEmail}</a></p>
        </div>

        <p>We're excited to have you on board and look forward to a successful partnership!</p>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Get application rejected notification template
   */
  getApplicationRejectedTemplate(params: {
    providerName: string
    rejectionCategory?: string
    rejectionReason?: string
    reapplyUrl: string
  }): string {
    const providerName = this.escapeHtml(params.providerName)
    // Format snake_case → Title Case first, THEN escape — keeps the entity
    // output canonical (`&lt;` not `&Lt;` after a stray title-case pass).
    const formattedCategory = params.rejectionCategory
      ? this.escapeHtml(formatSnakeCaseToTitleCase(params.rejectionCategory))
      : undefined
    const rejectionReason = params.rejectionReason
      ? this.escapeHtml(params.rejectionReason)
      : undefined

    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Application Update</h1>
      </div>
      <div class="email-body">
        <h2>Application Status Update</h2>
        <p>Dear ${providerName},</p>
        <p>Thank you for your interest in becoming a World-Camps provider. After careful review, we regret to inform you that we are unable to approve your application at this time.</p>

        ${
          formattedCategory || rejectionReason
            ? `
        <div class="danger-box">
          ${formattedCategory ? `<p style="margin: 0;"><strong>Category:</strong> ${formattedCategory}</p>` : ''}
          ${rejectionReason ? `<p style="margin: ${formattedCategory ? '8px' : '0'} 0 0 0;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
        </div>
        `
            : ''
        }

        <h2>What you can do</h2>
        <p>We encourage you to review our provider requirements and consider reapplying in the future. You may reapply once you've addressed the concerns mentioned above.</p>

        <div style="text-align: center;">
          <a href="${params.reapplyUrl}" class="button" style="background-color: ${this.colors.secondary}; color: white;">Review Requirements</a>
        </div>

        <div class="info-box">
          <p style="margin: 0;"><strong>Questions about your application?</strong></p>
          <p style="margin: 8px 0 0 0;">If you have any questions or would like more information about the decision, please don't hesitate to contact our support team.</p>
        </div>

        <p>We appreciate your interest in World-Camps and wish you the best in your future endeavors.</p>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Booking accepted — parent-facing confirmation that the card has been
   * charged and the spot is secured. Replaces the earlier in-app copy that
   * incorrectly told parents to "proceed to payment" after capture had
   * already succeeded.
   */
  /**
   * Get welcome email template for provider accounts created via admin import
   */
  getProviderImportWelcomeTemplate(params: {
    firstName: string
    email: string
    tempPassword: string
    loginUrl: string
  }): string {
    // Only `firstName` is admin-typed free text; `email` is RFC-validated
    // and `tempPassword` is server-generated (random charset).
    // Escape only the field with HTML-injection risk.
    const firstName = this.escapeHtml(params.firstName)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Welcome to World-Camps!</h1>
      </div>
      <div class="email-body">
        <h2>Your provider account has been created</h2>
        <p>Hi ${firstName},</p>
        <p>A World-Camps administrator has created a provider account for you. You can now log in to the provider portal and start setting up your camp profile.</p>

        <div class="info-box">
          <p style="margin: 0;"><strong>Your login credentials:</strong></p>
          <p style="margin: 8px 0 0 0;"><strong>Email:</strong> ${params.email}</p>
          <p style="margin: 4px 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #e5e5e5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${params.tempPassword}</code></p>
        </div>

        <div class="warning-box">
          <p style="margin: 0;"><strong>Important:</strong> Please change your password after your first login for security.</p>
        </div>

        <div style="text-align: center;">
          <a href="${params.loginUrl}" class="button">Access Your Dashboard</a>
        </div>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">If you have any questions, contact us at <a href="mailto:providers@world-camps.com" style="color: ${this.colors.primary};">providers@world-camps.com</a></p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Get login verification template for 2FA
   */
  /**
   * Off-session 3DS recovery email — sent when the balance-charge cron tried
   * to charge the parent's saved card and Stripe returned `requires_action`,
   * meaning the issuer demands a fresh 3DS step-up. The CTA links to the
   * /payment/authorize page with `payment_intent_client_secret` so the parent
   * can complete the challenge via `stripe.handleNextAction`.
   */
  getOffSession3dsRecoveryTemplate(params: {
    parentFirstName: string
    campName: string
    bookingGroupNumber: string
    amountFormatted: string
    recoveryUrl: string
  }): string {
    // User-controlled fields are HTML-escaped; URL stays raw because it's
    // already URL-encoded by the caller and needs to render as an `href`.
    const parentFirstName = this.escapeHtml(params.parentFirstName)
    const campName = this.escapeHtml(params.campName)
    const bookingGroupNumber = this.escapeHtml(params.bookingGroupNumber)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Verify your card</h1>
      </div>
      <div class="email-body">
        <p>Hi ${parentFirstName},</p>

        <p>We tried to charge your saved card the <strong>${params.amountFormatted}</strong>
        balance for your <strong>${campName}</strong> booking
        (<code>${bookingGroupNumber}</code>), but your bank wants to
        verify the payment with you first.</p>

        <p>Please complete the quick verification below — you'll be sent to
        your bank's site for a moment, then back to your bookings.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.recoveryUrl}" class="button">Verify card</a>
        </div>

        <p class="text-secondary" style="font-size: 14px;">If you don't verify
        within the next 48 hours, the booking will be paused until you update
        your payment method.</p>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Final-failure email — sent when the balance-charge cron has marked a
   * Payment terminal because either (a) the 48h / 2-attempt off-session
   * retry window was exhausted, (b) the parent has no saved payment method
   * on file, or (c) the parent abandoned a 3DS step-up past the 48h
   * window. The booking is now in `payment_failed`; this email is the
   * parent-facing heads-up so they can update their payment details.
   *
   * Copy is intentionally generic across the three cases — saying "we
   * tried twice and your card was declined" would be a lie for the
   * no-PM and step-up-abandoned paths.
   */
  getPaymentFailedFinalTemplate(params: {
    parentFirstName: string
    campName: string
    bookingGroupNumber: string
    amountFormatted: string
    bookingsUrl: string
  }): string {
    const parentFirstName = this.escapeHtml(params.parentFirstName)
    const campName = this.escapeHtml(params.campName)
    const bookingGroupNumber = this.escapeHtml(params.bookingGroupNumber)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>We couldn't process your payment</h1>
      </div>
      <div class="email-body">
        <p>Hi ${parentFirstName},</p>

        <p>We weren't able to process the
        <strong>${params.amountFormatted}</strong> balance payment for your
        <strong>${campName}</strong> booking
        (<code>${bookingGroupNumber}</code>).</p>

        <p>Your booking is paused for now. To get it back on track, please
        open your bookings dashboard to update your payment details — our
        team will reach out separately if anything else is needed.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.bookingsUrl}" class="button">Open your bookings</a>
        </div>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Parent-facing cancellation confirmation. Sent immediately after
   * a parent successfully cancels via the booking detail page. Body
   * differs by `mode` so the parent sees a truthful summary of what
   * happened (refund vs. authorization void vs. partial policy refund).
   */
  getBookingCancelledConfirmationTemplate(params: {
    parentFirstName: string
    campName: string
    bookingGroupNumber: string
    mode: 'void_auth' | 'grace' | 'policy'
    refundFormatted: string | null
    /** Only present when mode='policy' and the booking was past grace. */
    nonRefundedFormatted?: string | null
    bookingsUrl: string
  }): string {
    const parentFirstName = this.escapeHtml(params.parentFirstName)
    const campName = this.escapeHtml(params.campName)
    const bookingGroupNumber = this.escapeHtml(params.bookingGroupNumber)
    const refundFormatted = params.refundFormatted ? this.escapeHtml(params.refundFormatted) : null
    const nonRefundedFormatted = params.nonRefundedFormatted
      ? this.escapeHtml(params.nonRefundedFormatted)
      : null

    let summaryHtml: string
    if (params.mode === 'void_auth') {
      summaryHtml = `<p>No charge was made — your card was authorized but the camp had not yet
      accepted your booking, so we've simply released the hold on your card.</p>`
    } else if (params.mode === 'grace') {
      summaryHtml = `<p>Because you cancelled within the 48-hour grace period, you'll receive a
      <strong>full refund of ${refundFormatted ?? 'your payment'}</strong>. The refund typically
      lands within 5–10 business days, depending on your bank.</p>`
    } else {
      summaryHtml = `<p>Per the camp's cancellation policy, you'll receive a refund of
      <strong>${refundFormatted ?? '0.00'}</strong>${
        nonRefundedFormatted
          ? `. The non-refundable portion (${nonRefundedFormatted}) reflects the camp's policy and the deposit, which is non-refundable after the 48-hour grace period`
          : ''
      }.</p>`
    }

    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Your booking is cancelled</h1>
      </div>
      <div class="email-body">
        <p>Hi ${parentFirstName},</p>

        <p>We've cancelled your booking for <strong>${campName}</strong>
        (<code>${bookingGroupNumber}</code>).</p>

        ${summaryHtml}

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.bookingsUrl}" class="button">View your bookings</a>
        </div>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Reimbursement reminder. Sent by the daily reminder cron to the
   * provider's owner when a Reimbursement is overdue (dueDate < now). Under
   * Accounts v2 the platform absorbed the refund debit; the camp owes us
   * the equivalent and we collect either by deduction from their next
   * payout or by direct bank transfer. The reminder is best-effort — if
   * sending fails we don't stamp `lastReminderSentAt` and the cron picks
   * the row up again the next day.
   */
  getReimbursementReminderTemplate(params: {
    providerOwnerFirstName: string
    providerLegalCompanyName: string
    bookingGroupNumber: string
    amountOwedFormatted: string
    dueDateFormatted: string
    daysOverdue: number
    settlementInstructionsUrl: string
  }): string {
    const providerOwnerFirstName = this.escapeHtml(params.providerOwnerFirstName)
    const providerLegalCompanyName = this.escapeHtml(params.providerLegalCompanyName)
    const bookingGroupNumber = this.escapeHtml(params.bookingGroupNumber)
    const amountOwedFormatted = this.escapeHtml(params.amountOwedFormatted)
    const dueDateFormatted = this.escapeHtml(params.dueDateFormatted)
    const daysOverdue = Number.isFinite(params.daysOverdue) ? Math.max(params.daysOverdue, 0) : 0

    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Reimbursement due</h1>
      </div>
      <div class="email-body">
        <p>Hi ${providerOwnerFirstName},</p>

        <p>A booking for <strong>${providerLegalCompanyName}</strong>
        (<code>${bookingGroupNumber}</code>) was refunded after the camp's
        funds had already been disbursed. Per our terms, you owe World-Camps
        <strong>${amountOwedFormatted}</strong> to settle the difference.</p>

        <p>This was due on <strong>${dueDateFormatted}</strong>${
          daysOverdue > 0 ? ` — currently <strong>${daysOverdue}</strong> day(s) overdue` : ''
        }.</p>

        <p>You can settle by direct bank transfer, or we'll deduct the
        amount from your next payout. Reply to this email with how you'd
        like to proceed, or open the settlement guide for instructions.</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.settlementInstructionsUrl}" class="button">Settlement guide</a>
        </div>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  getLoginVerificationTemplate(code: string, expiryMinutes: number, userName: string): string {
    const safeUserName = this.escapeHtml(userName)
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Login Verification</h1>
      </div>
      <div class="email-body">
        <p>Hi ${safeUserName},</p>

        <p>We received a login attempt to your World-Camps account. Please use the verification code below to complete your login:</p>

        <div style="background-color: ${this.colors.backgroundGray}; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${this.colors.primary};">${code}</div>
        </div>

        <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>

        <div class="warning-box">
          <p style="margin: 0;"><strong>Security Notice</strong></p>
          <p style="margin: 8px 0 0 0;">If you didn't attempt to log in, please ignore this email or contact support if you're concerned about your account security.</p>
        </div>

        <div class="divider"></div>
        <p class="text-secondary" style="font-size: 14px;">Best regards,<br>The World-Camps Team</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }
}
