import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubmitFeedbackDto {
  @ApiProperty({
    description: 'Whether the article was helpful',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  helpful: boolean

  @ApiPropertyOptional({
    description: 'Session ID for anonymous users',
    example: 'session-uuid-here',
  })
  @IsOptional()
  @IsString()
  sessionId?: string
}
