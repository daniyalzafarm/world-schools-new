import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { ProviderReviewStatus } from '../../../../generated/client/enums'

export class ResolveProviderReviewDto {
  @ApiProperty({
    enum: [ProviderReviewStatus.under_review, ProviderReviewStatus.resolved],
    description: 'Move the review to `under_review` (picked up) or `resolved` (closed).',
  })
  @IsEnum(ProviderReviewStatus)
  @IsIn([ProviderReviewStatus.under_review, ProviderReviewStatus.resolved])
  status!: ProviderReviewStatus

  @ApiPropertyOptional({ description: 'Short decision label (e.g. "cleared", "suspended").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  decision?: string

  @ApiPropertyOptional({ description: 'Free-text reviewer notes.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  decisionNotes?: string
}
