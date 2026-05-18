import { ApiProperty } from '@nestjs/swagger'

export class StripeAddressDto {
  @ApiProperty({ required: false, nullable: true })
  line1: string | null

  @ApiProperty({ required: false, nullable: true })
  line2: string | null

  @ApiProperty({ required: false, nullable: true })
  city: string | null

  @ApiProperty({ required: false, nullable: true })
  state: string | null

  @ApiProperty({ required: false, nullable: true })
  postalCode: string | null

  @ApiProperty({ required: false, nullable: true, description: 'ISO 3166-1 alpha-2' })
  country: string | null
}

export class StripeBusinessProfileDto {
  @ApiProperty({ required: false, nullable: true })
  name: string | null

  @ApiProperty({ required: false, nullable: true })
  url: string | null

  @ApiProperty({ required: false, nullable: true })
  supportEmail: string | null

  @ApiProperty({ required: false, nullable: true })
  supportPhone: string | null

  @ApiProperty({ required: false, nullable: true })
  productDescription: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Stripe Merchant Category Code',
  })
  mcc: string | null
}

export class StripeRepresentativeDto {
  @ApiProperty({ required: false, nullable: true })
  firstName: string | null

  @ApiProperty({ required: false, nullable: true })
  lastName: string | null

  @ApiProperty({ required: false, nullable: true })
  email: string | null

  @ApiProperty({ required: false, nullable: true })
  phone: string | null

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Date of birth in ISO format (YYYY-MM-DD)',
  })
  dateOfBirth: string | null

  @ApiProperty({ type: () => StripeAddressDto, required: false, nullable: true })
  address: StripeAddressDto | null

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Stripe identity-verification status (unverified | pending | verified)',
  })
  verificationStatus: string | null
}

export class StripeCompanyDto {
  @ApiProperty({ required: false, nullable: true })
  name: string | null

  @ApiProperty({ required: false, nullable: true })
  phone: string | null

  @ApiProperty({ description: 'Whether a tax ID has been provided to Stripe' })
  taxIdProvided: boolean

  @ApiProperty({ type: () => StripeAddressDto, required: false, nullable: true })
  address: StripeAddressDto | null
}

export class StripeBankAccountDto {
  @ApiProperty({ description: 'Stripe id of the external account', example: 'ba_1ABCXYZ' })
  id: string

  @ApiProperty({
    description: 'Account type',
    enum: ['bank_account', 'card', 'other'],
  })
  type: 'bank_account' | 'card' | 'other'

  @ApiProperty({ required: false, nullable: true })
  bankName: string | null

  @ApiProperty({ required: false, nullable: true })
  last4: string | null

  @ApiProperty({ description: 'ISO 4217 currency code (lowercase)' })
  currency: string

  @ApiProperty({ required: false, nullable: true })
  country: string | null

  @ApiProperty({ required: false, nullable: true })
  accountHolderName: string | null

  @ApiProperty({ required: false, nullable: true })
  routingNumber: string | null

  @ApiProperty({ description: 'Whether this is the default payout method for its currency' })
  defaultForCurrency: boolean

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Stripe-side validation status (new | validated | verified | errored)',
  })
  status: string | null
}

export class StripePayoutScheduleDto {
  @ApiProperty({
    description: 'How frequently Stripe pays out',
    enum: ['manual', 'daily', 'weekly', 'monthly'],
    required: false,
    nullable: true,
  })
  interval: string | null

  @ApiProperty({
    description: 'Number of days funds are held before being paid out',
    required: false,
    nullable: true,
  })
  delayDays: number | null

  @ApiProperty({
    description: "Day of the week payouts run on (when interval is 'weekly')",
    required: false,
    nullable: true,
  })
  weeklyAnchor: string | null

  @ApiProperty({
    description: "Day of the month payouts run on (when interval is 'monthly', 1-31)",
    required: false,
    nullable: true,
  })
  monthlyAnchor: number | null
}

export class StripeAccountStatusDto {
  @ApiProperty({
    description:
      'Whether a Stripe Connect account has been created for this provider. ' +
      'When false, all other capability fields are also false and ids/requirements are null/empty.',
  })
  hasAccount: boolean

  @ApiProperty({
    description: 'Stripe Connect account ID (null if no account has been created yet)',
    example: 'acct_1234567890',
    required: false,
    nullable: true,
  })
  stripeAccountId: string | null

  @ApiProperty({ description: 'Whether the account can process charges' })
  chargesEnabled: boolean

  @ApiProperty({ description: 'Whether the account can receive payouts' })
  payoutsEnabled: boolean

  @ApiProperty({ description: 'Whether all required details have been submitted to Stripe' })
  detailsSubmitted: boolean

  @ApiProperty({
    description:
      'Cached signal that Stripe has open `requirements.currently_due` or `past_due` ' +
      'items on the account. Synced from the `account.updated` webhook so dashboard ' +
      'surfaces can highlight providers needing action without a live Stripe fetch.',
  })
  attentionRequired: boolean

  @ApiProperty({ description: 'Whether Stripe onboarding has been completed in our system' })
  onboardingCompleted: boolean

  @ApiProperty({
    description:
      'When the provider explicitly chose to skip Stripe onboarding (ISO 8601). ' +
      'Cleared once onboarding completes or the account is deauthorized.',
    required: false,
    nullable: true,
  })
  onboardingSkippedAt: string | null

  @ApiProperty({ description: 'Provider currency (ISO 4217, locked at creation)', example: 'USD' })
  currency: string

  @ApiProperty({
    description: 'App fee percentage applied to this provider',
    example: 10,
    required: false,
    nullable: true,
  })
  appFeePercentage: number | null

  @ApiProperty({
    description:
      'Live Stripe requirements due now to enable charges/payouts. ' +
      'Empty when no requirements are outstanding or no account exists yet.',
    type: [String],
    example: ['external_account', 'individual.verification.document'],
  })
  requirementsCurrentlyDue: string[]

  @ApiProperty({
    description: 'Live Stripe requirements past their due date — capabilities are disabled.',
    type: [String],
  })
  requirementsPastDue: string[]

  @ApiProperty({
    description:
      'Live Stripe requirements that will eventually be required. ' +
      'Capabilities still work but the provider should plan to satisfy these.',
    type: [String],
  })
  requirementsEventuallyDue: string[]

  @ApiProperty({
    description:
      'Reason Stripe has disabled the account (e.g. requirements.past_due, rejected.fraud). ' +
      'Null when the account is in good standing or when no account exists.',
    required: false,
    nullable: true,
  })
  disabledReason: string | null

  // ── Live profile data ─────────────────────────────────────────────────────

  @ApiProperty({
    description: 'Stripe account business type (individual | company | non_profit | …)',
    required: false,
    nullable: true,
  })
  businessType: string | null

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code of the Stripe account',
    required: false,
    nullable: true,
  })
  country: string | null

  @ApiProperty({
    description: 'Email address Stripe has on file for this account',
    required: false,
    nullable: true,
  })
  accountEmail: string | null

  @ApiProperty({
    description: 'When the Stripe account was created (ISO 8601)',
    required: false,
    nullable: true,
  })
  accountCreatedAt: string | null

  @ApiProperty({
    description: 'When Stripe terms of service were accepted (ISO 8601)',
    required: false,
    nullable: true,
  })
  tosAcceptedAt: string | null

  @ApiProperty({ type: () => StripeBusinessProfileDto, required: false, nullable: true })
  businessProfile: StripeBusinessProfileDto | null

  @ApiProperty({
    type: () => StripeRepresentativeDto,
    required: false,
    nullable: true,
    description: 'Set when business_type is individual or sole proprietor',
  })
  representative: StripeRepresentativeDto | null

  @ApiProperty({
    type: () => StripeCompanyDto,
    required: false,
    nullable: true,
    description: 'Set when business_type is company / non_profit / government_entity',
  })
  company: StripeCompanyDto | null

  @ApiProperty({
    type: () => [StripeBankAccountDto],
    description: 'Bank accounts and debit cards connected for payouts',
  })
  externalAccounts: StripeBankAccountDto[]

  @ApiProperty({ type: () => StripePayoutScheduleDto, required: false, nullable: true })
  payoutSchedule: StripePayoutScheduleDto | null
}

export class CreateAccountSessionResponseDto {
  @ApiProperty({ description: 'Single-use client secret for the Stripe embedded component' })
  clientSecret: string
}
