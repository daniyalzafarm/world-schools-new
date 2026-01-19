import { PartialType } from '@nestjs/mapped-types'
import { CreateFlexibleSessionDto } from './create-flexible-session.dto'
import { IsBoolean, IsOptional } from 'class-validator'

export class UpdateFlexibleSessionDto extends PartialType(CreateFlexibleSessionDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
