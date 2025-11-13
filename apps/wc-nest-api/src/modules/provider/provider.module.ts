import { Module } from '@nestjs/common';
import { ProviderAuthModule } from './auth/auth.module';
import { ProviderRolesModule } from './roles/roles.module';

@Module({
  imports: [ProviderAuthModule, ProviderRolesModule],
})
export class ProviderModule {}

