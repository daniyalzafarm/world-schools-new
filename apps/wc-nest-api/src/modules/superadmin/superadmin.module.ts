import { Module } from '@nestjs/common';
import { SuperAdminAuthModule } from './auth/auth.module';
import { SuperAdminRolesModule } from './roles/roles.module';
import { SuperAdminProvidersModule } from './providers/providers.module';

@Module({
  imports: [
    SuperAdminAuthModule,
    SuperAdminRolesModule,
    SuperAdminProvidersModule,
  ],
})
export class SuperAdminModule {}

