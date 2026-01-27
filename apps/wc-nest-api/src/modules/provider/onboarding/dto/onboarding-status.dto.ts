import { ApiProperty } from '@nestjs/swagger'

export class OnboardingStatusDto {
  @ApiProperty({
    description: 'Current onboarding step (1-6)',
    example: 3,
  })
  currentStep: number

  @ApiProperty({
    description: 'Whether onboarding is completed',
    example: false,
  })
  isCompleted: boolean

  @ApiProperty({
    description: 'Onboarding started timestamp',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  onboardingStartedAt?: string

  @ApiProperty({
    description: 'Onboarding completed timestamp',
    example: null,
    required: false,
  })
  onboardingCompletedAt?: string | null

  @ApiProperty({
    description: 'Approval status',
    example: 'pending',
    enum: ['pending', 'under_review', 'info_requested', 'approved', 'rejected', 'suspended'],
  })
  approvalStatus: string

  @ApiProperty({
    description: 'Trust score (0-100)',
    example: 85,
    required: false,
  })
  trustScore?: number | null

  @ApiProperty({
    description: 'Trust score breakdown by category',
    example: {
      hasGoogleBusiness: 10,
      googleRating: 12,
      googleReviews: 3,
      businessRegistration: 20,
      insuranceCertificate: 20,
      businessAge: 10,
      legalInfoComplete: 10,
    },
    required: false,
  })
  trustScoreBreakdown?: Record<string, number> | null

  @ApiProperty({
    description: 'Rejection reason',
    example: null,
    required: false,
  })
  rejectionReason?: string | null

  @ApiProperty({
    description: 'Rejection category',
    example: null,
    required: false,
  })
  rejectionCategory?: string | null

  @ApiProperty({
    description: 'Step completion status',
    example: {
      step1: true,
      step2: true,
      step3: false,
      step4: false,
      step5: false,
      step6: false,
    },
  })
  stepCompletion: {
    step1: boolean
    step2: boolean
    step3: boolean
    step4: boolean
    step5: boolean
    step6: boolean
  }

  @ApiProperty({
    description: 'Terms of Service acceptance timestamp',
    example: '2024-01-15T14:30:00Z',
    required: false,
  })
  termsAcceptedAt?: string | null

  @ApiProperty({
    description: 'Terms of Service version accepted',
    example: '1.0',
    required: false,
  })
  termsVersion?: string | null

  @ApiProperty({
    description: 'Provider Agreement acceptance timestamp',
    example: '2024-01-15T14:30:00Z',
    required: false,
  })
  providerAgreementAcceptedAt?: string | null

  @ApiProperty({
    description: 'Provider Agreement version accepted',
    example: '1.0',
    required: false,
  })
  providerAgreementVersion?: string | null
}
