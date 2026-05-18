import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * Evidence text fields for `POST /superadmin/disputes/:id/evidence`.
 *
 * Stripe accepts a wider set of fields, but the UI exposes the common-
 * denominator ones first. Each field is optional — submit a partial set,
 * or pass `submit=false` to save a draft (Stripe keeps the evidence on the
 * dispute and lets you submit later).
 *
 * The MIME type for the optional file uploads is enforced by the controller
 * (PDF / images / plain text only — Stripe's full list at:
 * https://stripe.com/docs/disputes/evidence#evidence-formats).
 */
export class SubmitEvidenceDto {
  @ApiPropertyOptional({ description: 'When true, evidence is submitted to Stripe (irrevocable).' })
  @IsOptional()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === '1' || value === 1 ? true : false
  )
  @IsBoolean()
  submit?: boolean

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_name?: string

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_email_address?: string

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_purchase_ip?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  product_description?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  customer_communication?: string

  @ApiPropertyOptional({ maxLength: 1_000 })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  shipping_address?: string

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  service_date?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  refund_policy?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  refund_policy_disclosure?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  cancellation_policy?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  cancellation_policy_disclosure?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  access_activity_log?: string

  @ApiPropertyOptional({ maxLength: 20_000 })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  uncategorized_text?: string
}

export const SUBMIT_EVIDENCE_TEXT_FIELDS: ReadonlyArray<keyof SubmitEvidenceDto> = [
  'customer_name',
  'customer_email_address',
  'customer_purchase_ip',
  'product_description',
  'customer_communication',
  'shipping_address',
  'service_date',
  'refund_policy',
  'refund_policy_disclosure',
  'cancellation_policy',
  'cancellation_policy_disclosure',
  'access_activity_log',
  'uncategorized_text',
]
