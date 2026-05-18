import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum ForceMajeureMode {
  cash = 'cash',
  credit_note = 'credit_note',
}

export class CancelForceMajeureDto {
  @ApiProperty({
    enum: ForceMajeureMode,
    description:
      '`cash` issues a Stripe refund (less the app fee); `credit_note` marks the booking cancelled and queues a credit note for the future docs module — no Stripe refund is issued.',
  })
  @IsEnum(ForceMajeureMode)
  mode!: ForceMajeureMode

  @ApiPropertyOptional({
    description: 'Optional admin note for the audit trail.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
