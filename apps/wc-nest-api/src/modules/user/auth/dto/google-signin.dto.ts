import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class GoogleSignInDto {
  @ApiProperty({
    description: 'Google ID-token credential returned by Google Identity Services',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjA1MjEvNCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  credential: string
}
