import { Module } from '@nestjs/common'
import { UserAuthModule } from './auth/auth.module'
import { UserChildrenModule } from './children/children.module'
import { UserCampsModule } from './camps/camps.module'

@Module({
  imports: [UserAuthModule, UserChildrenModule, UserCampsModule],
})
export class UserModule {}
