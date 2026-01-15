import { CreateAddOnDto } from './create-add-on.dto'
import { IsBoolean, IsOptional } from 'class-validator'
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger'

export class UpdateAddOnDto extends PartialType(CreateAddOnDto) {
  @ApiPropertyOptional({
    description: 'Whether the add-on is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
