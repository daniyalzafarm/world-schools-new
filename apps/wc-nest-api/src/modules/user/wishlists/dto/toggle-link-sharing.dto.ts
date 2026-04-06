import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class ToggleLinkSharingDto {
  @ApiProperty({ description: 'Enable or disable link sharing' })
  @IsBoolean()
  enabled: boolean
}
