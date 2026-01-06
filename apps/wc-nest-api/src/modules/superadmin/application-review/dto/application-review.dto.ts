import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
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
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
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
  status: string

  @ApiPropertyOptional({ description: 'Review notes' })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional({ description: 'Rejection reason (if rejected)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string
}

export class ApplicationDetailDto {
  id: string
  businessName: string
  email: string
  emailVerified: boolean
  phoneVerified: boolean
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
  providerName: string | null
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

export class ApplicationListItemDto {
  id: string
  businessName: string
  email: string
  approvalStatus: string
  trustScore: number | null
  onboardingCompletedAt: string | null
  submittedAt: string | null
  legalCompanyName: string | null
  contactFirstName: string | null
  contactLastName: string | null
  createdAt: string
}
