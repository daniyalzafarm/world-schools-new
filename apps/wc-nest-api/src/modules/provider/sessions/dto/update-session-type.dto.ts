import { IsEnum } from 'class-validator'

export class UpdateSessionTypeDto {
  @IsEnum(['flexible', 'fixed'])
  sessionType: 'flexible' | 'fixed'
}
