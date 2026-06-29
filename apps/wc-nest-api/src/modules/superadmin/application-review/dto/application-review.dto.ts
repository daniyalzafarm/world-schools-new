import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class GetApplicationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by approval status' })
  @IsOptional()
  @IsEnum(['pending', 'under_review', 'info_requested', 'approved', 'rejected', 'suspended'])
  status?: string

  @ApiPropertyOptional({ description: 'Search by provider name or email' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ description: 'Filter by minimum trust score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minTrustScore?: number

  @ApiPropertyOptional({ description: 'Filter by maximum trust score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxTrustScore?: number

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ description: 'Sort by field', default: 'onboardingCompletedAt' })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'
}

export class ApproveApplicationDto {
  @ApiPropertyOptional({ description: 'Optional approval notes' })
  @IsOptional()
  @IsString()
  notes?: string
}

export class RejectApplicationDto {
  @ApiProperty({ description: 'Reason for rejection (max 2000 chars)' })
  @IsString()
  // Cap admin-typed free-text. Schema column is
  // VARCHAR(2000); enforce at the DTO so 400s come back as clean validation
  // errors rather than DB constraint violations.
  @MaxLength(2000)
  reason: string

  @ApiProperty({ description: 'Rejection category' })
  @IsEnum([
    'incomplete_documents',
    'invalid_documents',
    'business_verification_failed',
    'policy_violation',
    'other',
  ])
  category: string

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}

export class RequestInfoDto {
  @ApiProperty({ description: 'Information request message' })
  @IsString()
  message: string

  @ApiPropertyOptional({ description: 'Specific fields or documents needed' })
  @IsOptional()
  @IsString()
  fieldsNeeded?: string
}

export class ReviewDocumentDto {
  @ApiProperty({ description: 'Review status' })
  @IsEnum(['approved', 'rejected', 'needs_reupload'])
  reviewStatus: string

  @ApiPropertyOptional({ description: 'Review notes (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string

  @ApiPropertyOptional({ description: 'Rejection reason (if rejected, max 2000 chars)' })
  @IsOptional()
  @IsString()
  // Same bound as `RejectApplicationDto.reason`. Both
  // paths write admin-typed free text into a `rejectionReason` column; both
  // need the cap to keep email-deliverability + payload sizes sane.
  @MaxLength(2000)
  rejectionReason?: string
}

export class ApplicationDetailDto {
  id: string
  businessName: string
  email: string
  emailVerified: boolean
  approvalStatus: string
  trustScore: number | null
  onboardingCompletedAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  rejectionReason: string | null
  rejectionCategory: string | null
  createdAt: string
  onboardingStartedAt: string | null
  approvalDecisionAt: string | null

  // Owner Info
  ownerFirstName: string | null
  ownerLastName: string | null
  ownerEmail: string

  // Contact Info
  contactFirstName: string | null
  contactLastName: string | null
  contactRole: string | null
  contactPhone: string | null
  contactEmail: string | null

  // Provider Details
  providerPhone: string | null
  providerEmail: string | null
  website: string | null

  // Legal Info
  legalCompanyName: string | null
  legalStreetAddress: string | null
  legalAptSuite: string | null
  legalCity: string | null
  legalStateProvince: string | null
  legalPostalCode: string | null
  legalCountry: string | null
  yearFounded: number | null

  // Google Business Profile
  googleBusinessProfile: any | null

  // Documents
  verificationDocuments: any[]

  // Settings
  settings: any | null

  // Trust Score Breakdown
  trustScoreBreakdown: any | null
}

/**
 * Underlying conditions that produced `operationalStatus`. Returned alongside
 * the status so the SuperAdmin tooltip can show "✓ Stripe connected, ✗ No
 * published sessions" without re-deriving the checks on the frontend.
 */
export interface OperationalStatusReasons {
  stripeConnected: boolean
  publishedCampCount: number
  publishedSessionCount: number
  hasRecentFailedPayout: boolean
  /// ISO 8601 timestamp of the most recent successful login by any user
  /// tied to this provider (owner or staff). Null when no one has ever
  /// logged in. The frontend derives both the precise time AND the
  /// relative-days display from this single field.
  lastLoginAt: string | null
}

export class ApplicationListItemDto {
  id: string
  businessName: string
  email: string
  approvalStatus: string
  trustScore: number | null
  /// Computed by `ApplicationReviewService.computeOperationalStatus`.
  /// Null for non-approved providers (the dot is only meaningful once a
  /// provider has been approved).
  operationalStatus: string | null
  /// Per-provider checklist that produced the status above. Null on
  /// non-approved rows for symmetry with `operationalStatus`.
  operationalStatusReasons: OperationalStatusReasons | null
  onboardingCompletedAt: string | null
  submittedAt: string | null
  legalCompanyName: string | null
  contactFirstName: string | null
  contactLastName: string | null
  createdAt: string
  logoUrl: string | null
}
