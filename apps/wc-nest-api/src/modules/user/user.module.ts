import { Module } from '@nestjs/common'
import { UserAuthModule } from './auth/auth.module'
import { UserChildrenModule } from './children/children.module'

@Module({
  imports: [UserAuthModule, UserChildrenModule],
})
export class UserModule {}
