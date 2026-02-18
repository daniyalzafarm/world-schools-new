import { Module } from '@nestjs/common'
import { UserAuthModule } from './auth/auth.module'
import { UserChildrenModule } from './children/children.module'
import { UserCampsModule } from './camps/camps.module'
import { UserMessagingModule } from './messaging/user-messaging.module'

@Module({
  imports: [UserAuthModule, UserChildrenModule, UserCampsModule, UserMessagingModule],
})
export class UserModule {}
