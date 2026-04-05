import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateReviewResponseDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  responseText: string
}
