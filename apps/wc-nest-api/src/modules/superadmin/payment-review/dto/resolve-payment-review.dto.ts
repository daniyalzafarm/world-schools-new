import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class ResolvePaymentReviewDto {
  @ApiProperty({
    enum: ['cancel', 'mark_resolved'],
    description:
      '`cancel` refunds captured funds + cancels the booking; `mark_resolved` records the admin handled it offline (no money action).',
  })
  @IsIn(['cancel', 'mark_resolved'])
  action!: 'cancel' | 'mark_resolved'

  @ApiPropertyOptional({ description: 'Optional reviewer notes (audit).' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string
}
