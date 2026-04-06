import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID } from 'class-validator'

export class UpdateWishlistItemDto {
  @ApiProperty({
    description: 'Selected session ID (null to clear)',
    nullable: true,
    required: false,
  })
  @IsString()
  @IsUUID('4')
  @IsOptional()
  sessionId?: string | null
}
