import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  registerDecorator,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { CANCELLATION_POLICY_VALUES } from '@world-schools/wc-types'

class SpecialCircumstanceDto {
  @ApiProperty({
    description: 'Type of special circumstance',
    enum: ['medical', 'force_majeure', 'weather'],
  })
  @IsString()
  @IsIn(['medical', 'force_majeure', 'weather'])
  type: string

  @ApiProperty({
    description: 'Percentage of balance to refund when this circumstance applies',
    enum: [50, 75, 90, 100],
  })
  @IsInt()
  @IsIn([50, 75, 90, 100])
  refundPercentage: number
}

class CustomPolicyTierDto {
  @ApiProperty({
    description: 'Days before camp start (canonical custom policy uses 90/60/30/0)',
    enum: [90, 60, 30, 0],
  })
  @IsInt()
  @IsIn([90, 60, 30, 0])
  daysBeforeStart: number

  @ApiProperty({
    description: 'Percentage of balance to refund at this tier',
    enum: [0, 25, 50, 75, 100],
  })
  @IsInt()
  @IsIn([0, 25, 50, 75, 100])
  refundPercentage: number
}

// Custom decorator: tiers must descend by daysBeforeStart with no duplicates,
// AND refund percentages must be monotonically non-increasing as we approach
// camp start (a closer-to-camp tier cannot refund MORE than a farther tier —
// that would let a parent game timing). Mirrors the wc-provider onboarding UI
// validation; defends in depth against direct API calls bypassing the form.
function IsValidCustomTierSchedule(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCustomTierSchedule',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) return false
          for (let i = 1; i < value.length; i++) {
            const prev = value[i - 1] as CustomPolicyTierDto
            const curr = value[i] as CustomPolicyTierDto
            if (curr.daysBeforeStart >= prev.daysBeforeStart) return false
            if (curr.refundPercentage > prev.refundPercentage) return false
          }
          return true
        },
        defaultMessage() {
          return 'Custom policy tiers must descend by daysBeforeStart with monotonically non-increasing refundPercentage'
        },
      },
    })
  }
}

class CustomPolicyDataDto {
  @ApiProperty({
    description: 'Custom policy tiers, descending by daysBeforeStart (canonical: 90/60/30/0)',
    type: [CustomPolicyTierDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CustomPolicyTierDto)
  @IsValidCustomTierSchedule()
  tiers: CustomPolicyTierDto[]
}

export class SaveProviderSettingsDto {
  @ApiProperty({
    description: 'Cancellation policy type',
    example: 'moderate',
    enum: CANCELLATION_POLICY_VALUES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(CANCELLATION_POLICY_VALUES)
  cancellationPolicy: string

  @ApiProperty({
    description: 'Custom cancellation policy tiers (required when cancellationPolicy is "custom")',
    example: { tiers: [{ daysBeforeStart: 90, refundPercentage: 100 }] },
    required: false,
    type: CustomPolicyDataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomPolicyDataDto)
  cancellationPolicyCustom?: CustomPolicyDataDto | null

  @ApiProperty({
    description: 'Special circumstance exceptions that override the standard policy',
    type: [SpecialCircumstanceDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialCircumstanceDto)
  cancellationPolicySpecialCircumstances?: SpecialCircumstanceDto[] | null

  @ApiProperty({
    description: 'Whether the provider agreed to the payment terms and cancellation policy',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  termsAgreed?: boolean
}
