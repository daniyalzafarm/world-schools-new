import { PartialType } from '@nestjs/mapped-types'
import { CreateFixedSessionDto } from './create-fixed-session.dto'
import { IsBoolean, IsOptional } from 'class-validator'

export class UpdateFixedSessionDto extends PartialType(CreateFixedSessionDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
