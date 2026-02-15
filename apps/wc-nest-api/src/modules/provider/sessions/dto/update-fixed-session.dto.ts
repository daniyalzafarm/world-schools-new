import { PartialType } from '@nestjs/mapped-types'
import { CreateFixedSessionDto } from './create-fixed-session.dto'

export class UpdateFixedSessionDto extends PartialType(CreateFixedSessionDto) {}
