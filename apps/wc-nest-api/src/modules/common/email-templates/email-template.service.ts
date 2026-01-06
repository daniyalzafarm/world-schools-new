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
  getVerificationEmailTemplate(code: string, expiryMinutes: number): string {
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Email Verification</h1>
      </div>
      <div class="email-body">
        <p>Thank you for registering with World-Camps!</p>
        <p>Please use the following verification code to complete your registration:</p>

        <div class="info-box" style="text-align: center;">
          <div style="font-size: 36px; font-weight: bold; color: ${this.colors.primary}; letter-spacing: 8px; margin: 10px 0;">
            ${code}
          </div>
        </div>

        <p class="text-secondary">This code will expire in ${expiryMinutes} minutes.</p>
        <p class="text-secondary">If you didn't request this code, please ignore this email.</p>
      </div>
      <div class="email-footer">
        <p>&copy; ${new Date().getFullYear()} World-Camps. All rights reserved.</p>
      </div>
    `
    return this.getBaseTemplate(content)
  }

  /**
   * Get application submitted confirmation template
   */
  getApplicationSubmittedTemplate(params: {
    providerName: string
    applicationId: string
    submittedDate: string
  }): string {
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Application Received</h1>
      </div>
      <div class="email-body">
        <h2>Thank you for your application!</h2>
        <p>Dear ${params.providerName},</p>
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
    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>🎉 Welcome to World-Camps!</h1>
      </div>
      <div class="email-body">
        <h2>Congratulations! Your application has been approved</h2>
        <p>Dear ${params.providerName},</p>
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
    // Format rejection category from snake_case to Title Case
    const formattedCategory = params.rejectionCategory
      ? formatSnakeCaseToTitleCase(params.rejectionCategory)
      : undefined

    const content = `
      <div class="email-header">
        <div class="logo">World-Camps</div>
        <h1>Application Update</h1>
      </div>
      <div class="email-body">
        <h2>Application Status Update</h2>
        <p>Dear ${params.providerName},</p>
        <p>Thank you for your interest in becoming a World-Camps provider. After careful review, we regret to inform you that we are unable to approve your application at this time.</p>

        ${
          formattedCategory || params.rejectionReason
            ? `
        <div class="danger-box">
          ${formattedCategory ? `<p style="margin: 0;"><strong>Category:</strong> ${formattedCategory}</p>` : ''}
          ${params.rejectionReason ? `<p style="margin: ${formattedCategory ? '8px' : '0'} 0 0 0;"><strong>Reason:</strong> ${params.rejectionReason}</p>` : ''}
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
}
