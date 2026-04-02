import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class CampBookingChildQuantityDto {
  @IsUUID()
  childId!: string

  @IsInt()
  @Min(0)
  @Max(999)
  quantity!: number
}

export class AddOnSelectionDto {
  @IsUUID()
  addOnId!: string

  @IsString()
  mode!: 'per_child' | 'per_child_qty' | 'qty'

  // qty mode
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  quantity?: number

  // per_child mode
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  childIds?: string[]

  // per_child_qty mode
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CampBookingChildQuantityDto)
  childQuantities?: CampBookingChildQuantityDto[]
}

export class SaveBookingGroupAddOnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnSelectionDto)
  addOns!: AddOnSelectionDto[]

  // Persist even when empty string to enable reload restoration.
  @IsOptional()
  @IsString()
  specialRequest?: string
}
