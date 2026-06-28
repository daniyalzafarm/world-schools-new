import { Test, TestingModule } from '@nestjs/testing'
import { EmailTemplateService } from './email-template.service'

/**
 * Covers the payment-template escapes plus the backfill
 * onto the legacy templates (verification, application emails, provider
 * import welcome, 2FA login).
 */
describe('EmailTemplateService — payment templates', () => {
  let service: EmailTemplateService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailTemplateService],
    }).compile()
    service = module.get(EmailTemplateService)
  })

  describe('getOffSession3dsRecoveryTemplate', () => {
    it('escapes user-controlled params so HTML in a camp name renders as text', () => {
      const html = service.getOffSession3dsRecoveryTemplate({
        parentFirstName: 'Ada',
        campName: 'My <script>alert(1)</script> Camp',
        bookingGroupNumber: 'BG-0001',
        amountFormatted: '€1,400.00',
        recoveryUrl: 'https://example.test/payment/authorize?payment_intent_client_secret=foo',
      })

      // The malicious markup is escaped, not rendered as a real <script> tag.
      expect(html).toContain('My &lt;script&gt;alert(1)&lt;/script&gt; Camp')
      expect(html).not.toContain('<script>alert(1)</script>')
      // The CTA URL is left raw because it goes into an `href`.
      expect(html).toContain(
        '<a href="https://example.test/payment/authorize?payment_intent_client_secret=foo"'
      )
    })

    it('escapes special HTML chars in parent first name and booking number', () => {
      const html = service.getOffSession3dsRecoveryTemplate({
        parentFirstName: 'Ada & "the" Lovelace',
        campName: 'Camp',
        bookingGroupNumber: 'BG&<>"01',
        amountFormatted: '€100',
        recoveryUrl: 'https://example.test/x',
      })

      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace')
      expect(html).toContain('BG&amp;&lt;&gt;&quot;01')
    })

    it('renders the recovery URL in an anchor and includes the formatted amount', () => {
      const html = service.getOffSession3dsRecoveryTemplate({
        parentFirstName: 'Ada',
        campName: 'Camp',
        bookingGroupNumber: 'BG-1',
        amountFormatted: '€1,400.00',
        recoveryUrl: 'https://example.test/payment/authorize?payment_intent_client_secret=foo',
      })

      expect(html).toContain('href="https://example.test/payment/authorize')
      expect(html).toContain('€1,400.00')
      expect(html).toContain('Verify card')
    })
  })

  describe('getPaymentFailedFinalTemplate', () => {
    it('escapes user-controlled params (Q4)', () => {
      const html = service.getPaymentFailedFinalTemplate({
        parentFirstName: '<b>Ada</b>',
        campName: '<img src=x>',
        bookingGroupNumber: 'BG-1',
        amountFormatted: '€1,400.00',
        bookingsUrl: 'https://example.test/bookings',
      })

      expect(html).toContain('&lt;b&gt;Ada&lt;/b&gt;')
      expect(html).toContain('&lt;img src=x&gt;')
      expect(html).not.toMatch(/<b>Ada<\/b>/)
      expect(html).not.toMatch(/<img src=x>/)
    })

    it('uses generic copy that covers card-declined, no-PM, AND step-up-abandoned cases', () => {
      // the prior template said "we tried twice and the
      // charge was declined both times" which lied for the no-PM and
      // step-up-abandoned paths. The new copy must NOT mention "twice" or
      // "declined" — those are specific to one of the three terminal paths.
      const html = service.getPaymentFailedFinalTemplate({
        parentFirstName: 'Ada',
        campName: 'Camp',
        bookingGroupNumber: 'BG-1',
        amountFormatted: '€1,400.00',
        bookingsUrl: 'https://example.test/bookings',
      })

      expect(html).not.toMatch(/twice/i)
      expect(html).not.toMatch(/declined both times/i)
      expect(html).toContain("weren't able to process")
    })
  })

  // ---------- cancellation / reimbursement templates ----------

  describe('getBookingCancelledConfirmationTemplate', () => {
    it('escapes user-controlled params', () => {
      const html = service.getBookingCancelledConfirmationTemplate({
        parentFirstName: '<b>Ada</b>',
        campName: 'My <script>alert(1)</script> Camp',
        bookingGroupNumber: 'BG&<>"01',
        mode: 'grace',
        refundFormatted: '€600.00',
        bookingsUrl: 'https://example.test/bookings',
      })
      expect(html).toContain('&lt;b&gt;Ada&lt;/b&gt;')
      expect(html).toContain('My &lt;script&gt;alert(1)&lt;/script&gt; Camp')
      expect(html).toContain('BG&amp;&lt;&gt;&quot;01')
      expect(html).not.toContain('<script>')
    })

    it('mode=void_auth: copy says no charge was made', () => {
      const html = service.getBookingCancelledConfirmationTemplate({
        parentFirstName: 'Ada',
        campName: 'Cool Camp',
        bookingGroupNumber: 'BG-1',
        mode: 'void_auth',
        refundFormatted: null,
        bookingsUrl: 'https://example.test/bookings',
      })
      expect(html).toMatch(/no charge was made/i)
      expect(html).toMatch(/released the hold/i)
    })

    it('mode=grace: shows full refund amount', () => {
      const html = service.getBookingCancelledConfirmationTemplate({
        parentFirstName: 'Ada',
        campName: 'Cool Camp',
        bookingGroupNumber: 'BG-1',
        mode: 'grace',
        refundFormatted: '€2,000.00',
        bookingsUrl: 'https://example.test/bookings',
      })
      expect(html).toMatch(/full refund/i)
      expect(html).toContain('€2,000.00')
    })

    it('mode=policy: shows refund + non-refunded breakdown', () => {
      const html = service.getBookingCancelledConfirmationTemplate({
        parentFirstName: 'Ada',
        campName: 'Cool Camp',
        bookingGroupNumber: 'BG-1',
        mode: 'policy',
        refundFormatted: '€700.00',
        nonRefundedFormatted: '€1,300.00',
        bookingsUrl: 'https://example.test/bookings',
      })
      expect(html).toContain('€700.00')
      expect(html).toContain('€1,300.00')
      expect(html).toMatch(/non-refundable portion/i)
    })

    it('mode=policy without nonRefundedFormatted omits the explanatory clause', () => {
      const html = service.getBookingCancelledConfirmationTemplate({
        parentFirstName: 'Ada',
        campName: 'Cool Camp',
        bookingGroupNumber: 'BG-1',
        mode: 'policy',
        refundFormatted: '€0.00',
        nonRefundedFormatted: null,
        bookingsUrl: 'https://example.test/bookings',
      })
      expect(html).not.toMatch(/non-refundable portion/i)
    })
  })

  describe('getReimbursementReminderTemplate', () => {
    it('escapes user-controlled params', () => {
      const html = service.getReimbursementReminderTemplate({
        providerOwnerFirstName: '<img src=x>',
        providerLegalCompanyName: '<b>Co</b>',
        bookingGroupNumber: 'BG&1',
        amountOwedFormatted: '€500.00',
        dueDateFormatted: 'April 1, 2026',
        daysOverdue: 3,
        settlementInstructionsUrl: 'https://example.test/billing',
      })
      expect(html).toContain('&lt;img src=x&gt;')
      expect(html).toContain('&lt;b&gt;Co&lt;/b&gt;')
      expect(html).toContain('BG&amp;1')
    })

    it('renders days-overdue indicator only when > 0', () => {
      const due = service.getReimbursementReminderTemplate({
        providerOwnerFirstName: 'Alex',
        providerLegalCompanyName: 'Cool Camp Ltd',
        bookingGroupNumber: 'BG-1',
        amountOwedFormatted: '€500.00',
        dueDateFormatted: 'April 1, 2026',
        daysOverdue: 5,
        settlementInstructionsUrl: 'https://example.test/billing',
      })
      expect(due).toMatch(/<strong>5<\/strong> day\(s\) overdue/)

      const onTime = service.getReimbursementReminderTemplate({
        providerOwnerFirstName: 'Alex',
        providerLegalCompanyName: 'Cool Camp Ltd',
        bookingGroupNumber: 'BG-1',
        amountOwedFormatted: '€500.00',
        dueDateFormatted: 'April 1, 2026',
        daysOverdue: 0,
        settlementInstructionsUrl: 'https://example.test/billing',
      })
      expect(onTime).not.toMatch(/overdue/i)
    })

    it('clamps negative daysOverdue to 0 (defends against clock skew)', () => {
      const html = service.getReimbursementReminderTemplate({
        providerOwnerFirstName: 'Alex',
        providerLegalCompanyName: 'Cool Camp Ltd',
        bookingGroupNumber: 'BG-1',
        amountOwedFormatted: '€500.00',
        dueDateFormatted: 'April 1, 2026',
        daysOverdue: -2,
        settlementInstructionsUrl: 'https://example.test/billing',
      })
      expect(html).not.toMatch(/-2/)
      expect(html).not.toMatch(/overdue/i)
    })
  })

  // ---------- legacy template escape backfill ----------

  describe('getVerificationEmailTemplate', () => {
    it('escapes script-tag injection in userName', () => {
      const html = service.getVerificationEmailTemplate(
        '123456',
        10,
        '<script>alert(1)</script>',
        'https://example.test/verify?token=abc',
        'provider'
      )
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes the five HTML entity chars in userName', () => {
      const html = service.getVerificationEmailTemplate(
        '123456',
        10,
        `Ada & "the" Lovelace's <kid>`,
        'https://example.test/verify',
        'provider'
      )
      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace&#39;s &lt;kid&gt;')
    })

    it('leaves the verification URL raw inside the href', () => {
      const html = service.getVerificationEmailTemplate(
        '123456',
        10,
        'Ada',
        'https://example.test/verify?token=abc&next=/x',
        'provider'
      )
      expect(html).toContain('href="https://example.test/verify?token=abc&next=/x"')
    })

    // a parent's verification email must NOT carry provider-targeted copy.
    it('renders parent-targeted copy + support contact for the parent audience', () => {
      const html = service.getVerificationEmailTemplate(
        '123456',
        10,
        'Sarah',
        'https://example.test/verify',
        'parent'
      )
      expect(html).not.toContain('joining World Camps as a camp provider')
      expect(html).not.toContain('setting up your camp profile')
      expect(html).not.toContain('providers@world-camps.com')
      expect(html).not.toContain('Contact our provider support team')
      expect(html).toContain('discover and book amazing camp experiences for your family')
      expect(html).toContain('mailto:support@world-camps.com')
    })

    it('keeps provider-targeted copy + support contact for the provider audience', () => {
      const html = service.getVerificationEmailTemplate(
        '123456',
        10,
        'Acme Camps',
        'https://example.test/verify',
        'provider'
      )
      expect(html).toContain('joining World Camps as a camp provider')
      expect(html).toContain('setting up your camp profile')
      expect(html).toContain('mailto:providers@world-camps.com')
      expect(html).toContain('Contact our provider support team')
    })
  })

  describe('getApplicationSubmittedTemplate', () => {
    it('escapes script-tag injection in providerName', () => {
      const html = service.getApplicationSubmittedTemplate({
        providerName: '<script>alert(1)</script>',
        applicationId: 'app-1',
        submittedDate: 'April 1, 2026',
      })
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes the five HTML entity chars in providerName', () => {
      const html = service.getApplicationSubmittedTemplate({
        providerName: `Ada & "the" Lovelace's <co>`,
        applicationId: 'app-1',
        submittedDate: 'April 1, 2026',
      })
      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace&#39;s &lt;co&gt;')
    })
  })

  describe('getApplicationApprovedTemplate', () => {
    it('escapes script-tag injection in providerName', () => {
      const html = service.getApplicationApprovedTemplate({
        providerName: '<script>alert(1)</script>',
        loginUrl: 'https://example.test/login',
        contactEmail: 'support@example.test',
      })
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes the five HTML entity chars in providerName', () => {
      const html = service.getApplicationApprovedTemplate({
        providerName: `Ada & "the" Lovelace's <co>`,
        loginUrl: 'https://example.test/login',
        contactEmail: 'support@example.test',
      })
      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace&#39;s &lt;co&gt;')
    })

    it('leaves the login URL raw inside the href', () => {
      const html = service.getApplicationApprovedTemplate({
        providerName: 'Cool Camp',
        loginUrl: 'https://example.test/login?next=/dashboard',
        contactEmail: 'support@example.test',
      })
      expect(html).toContain('href="https://example.test/login?next=/dashboard"')
    })
  })

  describe('getApplicationRejectedTemplate', () => {
    it('escapes script-tag injection in providerName', () => {
      const html = service.getApplicationRejectedTemplate({
        providerName: '<script>alert(1)</script>',
        reapplyUrl: 'https://example.test/reapply',
      })
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes script-tag injection in rejectionReason (highest-risk admin field)', () => {
      const html = service.getApplicationRejectedTemplate({
        providerName: 'Cool Camp',
        rejectionReason: 'Missing <script>fetch("/x")</script> docs',
        reapplyUrl: 'https://example.test/reapply',
      })
      expect(html).toContain('Missing &lt;script&gt;fetch(&quot;/x&quot;)&lt;/script&gt; docs')
      expect(html).not.toContain('<script>fetch("/x")</script>')
    })

    it('escapes script-tag injection in rejectionCategory after Title Casing', () => {
      // Even with snake_case format pass, embedded HTML must still come out
      // escaped. We feed in a value that survives the format step intact and
      // assert the escape pass closes the loop.
      const html = service.getApplicationRejectedTemplate({
        providerName: 'Cool Camp',
        rejectionCategory: '<script>alert(2)</script>',
        reapplyUrl: 'https://example.test/reapply',
      })
      expect(html).not.toContain('<script>alert(2)</script>')
      expect(html).toMatch(/&lt;script&gt;/i)
    })

    it('escapes inadvertent admin-typed HTML in rejectionReason rather than rendering it', () => {
      // Plan §Verification step 4 — admins have no formatting affordance, so
      // <b> in their reason should appear as escaped text, not bold.
      const html = service.getApplicationRejectedTemplate({
        providerName: 'Acme',
        rejectionReason: 'Missing <b>safety</b> docs',
        reapplyUrl: 'https://example.test/reapply',
      })
      expect(html).toContain('Missing &lt;b&gt;safety&lt;/b&gt; docs')
      expect(html).not.toContain('<b>safety</b>')
    })

    it('omits the danger-box section entirely when both category and reason are absent', () => {
      const html = service.getApplicationRejectedTemplate({
        providerName: 'Cool Camp',
        reapplyUrl: 'https://example.test/reapply',
      })
      expect(html).not.toContain('Category:')
      expect(html).not.toContain('Reason:')
    })
  })

  describe('getProviderImportWelcomeTemplate', () => {
    it('escapes script-tag injection in firstName', () => {
      const html = service.getProviderImportWelcomeTemplate({
        firstName: '<script>alert(1)</script>',
        email: 'admin@example.test',
        tempPassword: 'TempPassword123!',
        loginUrl: 'https://example.test/login',
      })
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes the five HTML entity chars in firstName', () => {
      const html = service.getProviderImportWelcomeTemplate({
        firstName: `Ada & "the" Lovelace's <kid>`,
        email: 'admin@example.test',
        tempPassword: 'TempPassword123!',
        loginUrl: 'https://example.test/login',
      })
      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace&#39;s &lt;kid&gt;')
    })
  })

  describe('getLoginVerificationTemplate', () => {
    it('escapes script-tag injection in userName', () => {
      const html = service.getLoginVerificationTemplate('123456', 10, '<script>alert(1)</script>')
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert(1)</script>')
    })

    it('escapes the five HTML entity chars in userName', () => {
      const html = service.getLoginVerificationTemplate(
        '123456',
        10,
        `Ada & "the" Lovelace's <kid>`
      )
      expect(html).toContain('Ada &amp; &quot;the&quot; Lovelace&#39;s &lt;kid&gt;')
    })
  })
})
