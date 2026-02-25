# Security Settings Implementation Plan

## Overview
This document outlines the comprehensive implementation plan for the Security Settings feature across **all three frontend applications** in the World Schools platform. The implementation includes Change Password (modal-based), Email-based 2FA, Active Sessions Management, and Account & Privacy navigation.

**Multi-App Architecture:**
- **Backend:** `wc-nest-api` (shared authentication system)
- **Frontend Apps:**
  - `wc-booking` - Parent/User portal
  - `wc-provider` - Provider portal
  - `wc-superadmin` - Superadmin portal

**Reference Designs:**
- Parent: `/Users/daniyal/files/dev/danidev/booking-design/Parents/account/settings/parent_security-settings.html`
- Provider: TBD (follow same design patterns)
- Superadmin: TBD (follow same design patterns)

**Target Pages:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/account/settings/security/page.tsx`
- `world-schools/apps/wc-provider/src/app/(dashboard)/account/settings/security/page.tsx`
- `world-schools/apps/wc-superadmin/src/app/(dashboard)/account/settings/security/page.tsx`

---

## Multi-App Architecture Considerations

### Backend Architecture

The backend uses a **shared core authentication module** with **user-type-specific controllers**:

```
apps/wc-nest-api/src/modules/
├── core/
│   └── auth/                          # 🔧 SHARED - All user types
│       ├── auth.service.ts            # Change password, login validation
│       └── services/
│           └── password-reset.service.ts  # Password reset logic
├── user/
│   └── auth/                          # 📱 PARENT-SPECIFIC
│       ├── auth.controller.ts         # /user/auth/* endpoints
│       └── services/
│           ├── two-factor-auth.service.ts
│           └── session-management.service.ts
├── provider/
│   └── auth/                          # 📱 PROVIDER-SPECIFIC
│       ├── auth.controller.ts         # /provider/auth/* endpoints
│       └── services/
│           ├── two-factor-auth.service.ts
│           └── session-management.service.ts
└── superadmin/
    └── auth/                          # 📱 SUPERADMIN-SPECIFIC
        ├── auth.controller.ts         # /superadmin/auth/* endpoints
        └── services/
            ├── two-factor-auth.service.ts
            └── session-management.service.ts
```

### Implementation Strategy

**Shared Backend Logic (Core Module):**
- ✅ Password hashing and validation
- ✅ Password change logic (`AuthService.changePassword`)
- ✅ Password reset logic (`PasswordResetService`)
- ✅ Email verification table (shared for all user types)
- ✅ Database schema (User, TwoFactorAuth, UserSession tables)

**User-Type-Specific Backend Logic:**
- 📱 Auth controllers (separate endpoints per user type)
- 📱 2FA services (can be shared or duplicated based on requirements)
- 📱 Session management services (can be shared or duplicated)
- 📱 Email templates (may have different branding per user type)

**Frontend Implementation:**
- 📱 Each app has its own Security Settings page
- 📱 Each app has its own API service layer
- 🔄 Components can be shared via `@world-schools/ui-web` library
- 🔄 Utilities can be shared via `@world-schools/wc-frontend-utils` library

### Phase-by-Phase App Coverage

| Phase | Backend Module | wc-booking | wc-provider | wc-superadmin | Status |
|-------|---------------|------------|-------------|---------------|--------|
| **Phase 1** | Database Schema | ✅ All | ✅ All | ✅ All | ✅ **COMPLETE** |
| **Phase 2** | Password Enhancement | ✅ All | ✅ All | ✅ All | ✅ **COMPLETE** |
| **Phase 3** | Email 2FA Backend | 🔄 User | 🔄 Provider | 🔄 Superadmin | 🔜 Pending |
| **Phase 4** | Session Management Backend | 🔄 User | 🔄 Provider | 🔄 Superadmin | 🔜 Pending |
| **Phase 5** | Security Page UI | 📱 Parent | 📱 Provider | 📱 Superadmin | 🔜 Pending |
| **Phase 6** | Frontend Services | 📱 Parent | 📱 Provider | 📱 Superadmin | 🔜 Pending |
| **Phase 7-12** | Standards, Testing, Docs | 🔄 All | 🔄 All | 🔄 All | 🔜 Pending |

**Legend:**
- ✅ Implemented and verified
- 🔄 Needs implementation for this app
- 📱 App-specific implementation required
- 🔧 Shared across all apps
- 🔜 Pending implementation

### Security Feature Parity

All three user types (Parent, Provider, Superadmin) will have **complete feature parity** for security settings:

| Feature | Parent | Provider | Superadmin | Notes |
|---------|--------|----------|------------|-------|
| **Change Password** | ✅ Yes | ✅ Yes | ✅ Yes | Shared `AuthService` |
| **Password Age Tracking** | ✅ Yes | ✅ Yes | ✅ Yes | Shared `passwordChangedAt` field |
| **Email 2FA** | ✅ Yes | ✅ Yes | ✅ Yes | Same mechanism, different endpoints |
| **Active Sessions** | ✅ Yes | ✅ Yes | ✅ Yes | Shared `UserSession` table |
| **Session Revocation** | ✅ Yes | ✅ Yes | ✅ Yes | Same functionality |
| **Security Settings Page** | ✅ Yes | ✅ Yes | ✅ Yes | Same UI, different routes |

### API Endpoint Structure

Each user type has its own set of endpoints following the same pattern:

**Parent Endpoints:**
```
POST   /user/auth/change-password
GET    /user/auth/profile
GET    /user/auth/two-factor/status
POST   /user/auth/two-factor/enable
POST   /user/auth/two-factor/disable
GET    /user/auth/sessions
DELETE /user/auth/sessions/:sessionId
POST   /user/auth/sessions/revoke-all-others
```

**Provider Endpoints:**
```
POST   /provider/auth/change-password
GET    /provider/auth/profile
GET    /provider/auth/two-factor/status
POST   /provider/auth/two-factor/enable
POST   /provider/auth/two-factor/disable
GET    /provider/auth/sessions
DELETE /provider/auth/sessions/:sessionId
POST   /provider/auth/sessions/revoke-all-others
```

**Superadmin Endpoints:**
```
POST   /superadmin/auth/change-password
GET    /superadmin/auth/profile
GET    /superadmin/auth/two-factor/status
POST   /superadmin/auth/two-factor/enable
POST   /superadmin/auth/two-factor/disable
GET    /superadmin/auth/sessions
DELETE /superadmin/auth/sessions/:sessionId
POST   /superadmin/auth/sessions/revoke-all-others
```

### Implementation Notes

1. **Shared Database Tables:**
   - All user types share the same `User`, `TwoFactorAuth`, `UserSession`, and `EmailVerification` tables
   - No user-type-specific tables needed for security features

2. **Service Reusability:**
   - Consider creating shared services in `core/auth/services/` that can be imported by all three auth modules
   - Alternatively, duplicate services in each module for better separation of concerns

3. **Email Templates:**
   - May need different branding/styling per user type
   - Consider parameterizing templates or creating user-type-specific versions

4. **Frontend Component Sharing:**
   - Create shared components in `@world-schools/ui-web` for:
     - Password change modal
     - 2FA toggle component
     - Session list component
   - Each app imports and uses these shared components

5. **Testing Strategy:**
   - Test each user type's endpoints separately
   - Ensure session isolation (users can only see/revoke their own sessions)
   - Verify 2FA works independently for each user type

---

## Key Architectural Decisions

### 1. Reuse EmailVerification Table for 2FA Login Codes
**Decision:** Use the existing `EmailVerification` table for both signup verification and 2FA login codes, differentiated by a `type` field.

**Rationale:**
- Both use cases share the same mechanism (6-digit codes sent via email)
- Same expiry logic (15 minutes)
- Same verification flow
- Reduces database complexity and maintenance overhead
- Easier to query and manage

**Implementation:** Add `type` field with values `'signup'` or `'login_2fa'`, plus optional `ipAddress` and `userAgent` metadata fields.

### 2. Separate Session IDs (NOT JWT Tokens)
**Decision:** Generate unique `sessionId` (UUID) for session tracking instead of storing JWT access tokens in the database.

**Rationale (2026 Security Best Practices):**
- **JWTs are stateless by design** - storing them in database defeats their purpose
- **Security risk** - database breach would expose all active JWT tokens
- **Performance** - avoids unnecessary database lookups on every request
- **Flexibility** - allows session management without invalidating JWT structure
- **Industry standard** - separate session identifiers are the recommended approach

**Implementation:**
- Generate `sessionId` (UUID) when creating session
- Store `sessionId` in `UserSession` table
- Include `sessionId` in JWT payload as custom claim
- Use `sessionId` for session management operations (list, revoke)
- Soft delete sessions using `isRevoked` flag instead of hard delete

---

## Table of Contents

- [Overview](#overview)
- [Multi-App Architecture Considerations](#multi-app-architecture-considerations)
  - [Backend Architecture](#backend-architecture)
  - [Implementation Strategy](#implementation-strategy)
  - [Phase-by-Phase App Coverage](#phase-by-phase-app-coverage)
  - [Security Feature Parity](#security-feature-parity)
  - [API Endpoint Structure](#api-endpoint-structure)
  - [Implementation Notes](#implementation-notes)
- [Key Architectural Decisions](#key-architectural-decisions)
  - [1. Reuse EmailVerification Table for 2FA Login Codes](#1-reuse-emailverification-table-for-2fa-login-codes)
  - [2. Separate Session IDs (NOT JWT Tokens)](#2-separate-session-ids-not-jwt-tokens)
- [Phase 1: Database Schema Changes](#phase-1-database-schema-changes)
  - [1.1 Add Password Tracking Field](#11-add-password-tracking-field)
  - [1.2 Update EmailVerification Table](#12-update-emailverification-table)
  - [1.3 Create TwoFactorAuth Table](#13-create-twofactorauth-table)
  - [1.4 Create UserSession Table](#14-create-usersession-table)
  - [1.5 Update User Model Relations](#15-update-user-model-relations)
  - [1.6 Migration Command](#16-migration-command)
- [Phase 2: Backend Implementation - Change Password Enhancement](#phase-2-backend-implementation---change-password-enhancement)
  - [2.1 Update AuthService](#21-update-authservice)
  - [2.2 Update User Profile Endpoint](#22-update-user-profile-endpoint)
- [Phase 3: Backend Implementation - Email 2FA](#phase-3-backend-implementation---email-2fa)
  - [3.1 Create TwoFactorAuthService](#31-create-twofactorauthservice)
  - [3.2 Create Email Template for Login Verification](#32-create-email-template-for-login-verification)
  - [3.3 Create 2FA Controller Endpoints](#33-create-2fa-controller-endpoints)
  - [3.4 Update Login Flow for 2FA](#34-update-login-flow-for-2fa)
- [Phase 4: Backend Implementation - Session Management](#phase-4-backend-implementation---session-management)
  - [4.1 Create SessionManagementService](#41-create-sessionmanagementservice)
  - [4.2 Create Session Controller Endpoints](#42-create-session-controller-endpoints)
  - [4.3 Update Login to Create Session](#43-update-login-to-create-session)
- [Phase 5: Frontend Implementation - Security Settings Page](#phase-5-frontend-implementation---security-settings-page)
  - [5.1 Create Security Settings Page](#51-create-security-settings-page)
- [Phase 6: Frontend Services & API Integration](#phase-6-frontend-services--api-integration)
  - [6.1 Create Security Services](#61-create-security-services)
- [Phase 7: Code Standards & Patterns](#phase-7-code-standards--patterns)
  - [7.1 Styling Consistency](#71-styling-consistency)
  - [7.2 Component Patterns](#72-component-patterns)
  - [7.3 Error Handling](#73-error-handling)
  - [7.4 TypeScript Types](#74-typescript-types)
- [Phase 8: Testing Considerations](#phase-8-testing-considerations)
  - [8.1 Backend Tests](#81-backend-tests)
  - [8.2 Frontend Tests](#82-frontend-tests)
  - [8.3 E2E Tests](#83-e2e-tests)
- [Phase 9: Security Considerations](#phase-9-security-considerations)
  - [9.1 Password Security](#91-password-security)
  - [9.2 2FA Security](#92-2fa-security)
  - [9.3 Session Security](#93-session-security)
  - [9.4 API Security](#94-api-security)
- [Phase 10: Dependencies](#phase-10-dependencies)
  - [10.1 New NPM Packages](#101-new-npm-packages)
  - [10.2 Existing Dependencies](#102-existing-dependencies)
- [Phase 11: Implementation Sequence](#phase-11-implementation-sequence)
  - [Step 1: Database Setup (Day 1) ✅ COMPLETE](#step-1-database-setup-day-1--complete)
  - [Step 2: Backend - Password Enhancement (Day 1) ✅ COMPLETE](#step-2-backend---password-enhancement-day-1--complete)
  - [Step 3: Backend - 2FA (Day 2-4) 🔄 PENDING](#step-3-backend---2fa-day-2-4--pending)
  - [Step 4: Backend - Session Management (Day 4-6) 🔄 PENDING](#step-4-backend---session-management-day-4-6--pending)
  - [Step 5: Frontend - Security Page (Day 6-9) 🔄 PENDING](#step-5-frontend---security-page-day-6-9--pending)
  - [Step 6: Frontend - Services (Day 9-10) 🔄 PENDING](#step-6-frontend---services-day-9-10--pending)
  - [Step 7: Testing & Polish (Day 10-12) 🔄 PENDING](#step-7-testing--polish-day-10-12--pending)
  - [Step 8: Documentation (Day 12) 🔄 PENDING](#step-8-documentation-day-12--pending)
- [Phase 12: Verification Checklist](#phase-12-verification-checklist)
  - [Database](#database)
  - [Backend - Password](#backend---password)
  - [Backend - 2FA](#backend---2fa)
  - [Backend - Sessions](#backend---sessions)
  - [Frontend](#frontend)
  - [Security](#security)
  - [Code Quality](#code-quality)
- [Notes](#notes)
- [Future Enhancements (Out of Scope)](#future-enhancements-out-of-scope)

---

## Phase 1: Database Schema Changes

**Status:** ✅ **COMPLETE** - Affects all user types (shared database tables)

**Backend Module:** 🔧 Core (Prisma Schema)
**Affects:** 🔄 All user types (Parent, Provider, Superadmin)

**Implementation Notes:**
- All database tables are shared across all three user types
- No user-type-specific tables needed for security features
- Changes apply to the entire authentication system

### 1.1 Add Password Tracking Field
**File:** `world-schools/apps/wc-nest-api/prisma/schema.prisma`

Add `passwordChangedAt` field to User model:
```prisma
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String?   @map("password_hash")
  passwordChangedAt DateTime? @map("password_changed_at")  // NEW FIELD
  // ... existing fields
}
```

### 1.2 Update EmailVerification Table
**Reuse existing table for both signup and 2FA login verification codes**

Add `type` and optional metadata fields to existing `EmailVerification` table:
```prisma
model EmailVerification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  code      String
  type      String   @default("signup")  // NEW: 'signup' or 'login_2fa'
  expiresAt DateTime @map("expires_at")
  verified  Boolean  @default(false)
  ipAddress String?  @map("ip_address")  // NEW: Optional metadata
  userAgent String?  @map("user_agent")  // NEW: Optional metadata
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([code])
  @@index([type])  // NEW: Index for filtering by type
  @@index([expiresAt])
  @@map("email_verifications")
}
```

**Rationale for Reusing EmailVerification:**
- Both signup and 2FA login use the same mechanism (6-digit codes sent via email)
- Same expiry logic (15 minutes)
- Same verification flow
- Reduces database complexity
- Easier to maintain and query
- The `type` field clearly differentiates the purpose

### 1.3 Create TwoFactorAuth Table
Create new table for 2FA settings:
```prisma
model TwoFactorAuth {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  method    String   // 'email' (only email for now)
  enabled   Boolean  @default(false)
  enabledAt DateTime? @map("enabled_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([enabled])
  @@map("two_factor_auth")
}
```

### 1.4 Create UserSession Table
Create table for active session tracking:
```prisma
model UserSession {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  sessionId    String   @unique @map("session_id")  // CHANGED: Separate UUID, NOT the JWT
  deviceType   String?  @map("device_type")         // 'desktop', 'mobile', 'tablet'
  deviceName   String?  @map("device_name")         // 'Chrome on MacOS', 'Safari on iPhone'
  browser      String?
  os           String?
  ipAddress    String?  @map("ip_address")
  location     String?  // 'Lausanne, Switzerland'
  isRevoked    Boolean  @default(false) @map("is_revoked")  // NEW: Track revocation status
  lastActiveAt DateTime @default(now()) @map("last_active_at")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sessionId])
  @@index([expiresAt])
  @@index([isRevoked])
  @@map("user_sessions")
}
```

**Security Best Practice (2026):**
- **DO NOT store JWT access tokens in the database** - this defeats the purpose of stateless JWTs
- Instead, generate a separate `sessionId` (UUID) for database tracking
- Include the `sessionId` in the JWT payload as a custom claim
- This allows session management (listing, revocation) without storing sensitive tokens
- Reduces attack surface - database breach doesn't expose active JWTs

### 1.5 Update User Model Relations
Add relations to User model:
```prisma
model User {
  // ... existing fields
  twoFactorAuth      TwoFactorAuth?
  sessions           UserSession[]
  // ... existing relations
  // NOTE: EmailVerification relation already exists, no changes needed
}
```

### 1.6 Migration Command
```bash
npx prisma migrate dev --name add_security_features
npx prisma generate
npx nx reset
npx nx build wc-nest-api --skip-nx-cache
```

---

## Phase 2: Backend Implementation - Change Password Enhancement

**Status:** ✅ **COMPLETE** - Affects all user types

**Backend Modules:**
- 🔧 Core (`modules/core/auth`) - Shared logic
- 📱 User (`modules/user/auth`) - Parent-specific endpoints
- 📱 Provider (`modules/provider/auth`) - Provider-specific endpoints
- 📱 Superadmin (`modules/superadmin/auth`) - Superadmin-specific endpoints

**What Was Implemented:**
1. ✅ Updated `AuthService.changePassword` to set `passwordChangedAt` (shared across all user types)
2. ✅ Updated User auth controller `getProfile` to return `passwordChangedAt`
3. ✅ Updated Provider auth controller `getProfile` to return `passwordChangedAt`
4. ✅ Updated Superadmin auth controller `getProfile` to return `passwordChangedAt`
5. ✅ Updated User registration to set initial `passwordChangedAt`
6. ✅ Updated Provider registration to set initial `passwordChangedAt`
7. ✅ Updated `PasswordResetService.resetPassword` to set `passwordChangedAt`

**Complete Password Lifecycle Tracking:**
- ✅ User Registration → `passwordChangedAt` set
- ✅ Provider Registration → `passwordChangedAt` set
- ✅ Change Password → `passwordChangedAt` updated
- ✅ Reset Password → `passwordChangedAt` updated

### 2.1 Update AuthService
**File:** `world-schools/apps/wc-nest-api/src/modules/core/auth/auth.service.ts`

Modify `changePassword` method to update `passwordChangedAt`:
```typescript
async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
  // ... existing validation logic

  // Update password AND passwordChangedAt
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashedNewPassword,
      passwordChangedAt: new Date()  // NEW
    },
  })
}
```

### 2.2 Update User Profile Endpoint
**File:** `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts`

Update `getProfile` endpoint to include `passwordChangedAt`:
```typescript
@Get('profile')
async getProfile(@CurrentUser() user: any) {
  const fullUser = await this.prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      emailVerified: true,
      passwordChangedAt: true,  // NEW
      // ... other fields
    },
  })
  return fullUser
}
```

---

## Phase 3: Backend Implementation - Email 2FA

**Status:** 🔄 **PENDING** - Needs implementation for all user types

**Backend Modules:**
- 📱 User (`modules/user/auth/services`) - Parent 2FA service
- 📱 Provider (`modules/provider/auth/services`) - Provider 2FA service
- 📱 Superadmin (`modules/superadmin/auth/services`) - Superadmin 2FA service

**Implementation Strategy:**
- **Option A (Recommended):** Create shared `TwoFactorAuthService` in `modules/core/auth/services/` and import in all three modules
- **Option B:** Duplicate service in each module for better separation of concerns

**Multi-App Considerations:**
- All three user types will have Email 2FA capability
- Same mechanism (6-digit codes, 15-minute expiry)
- May need different email templates for branding (Parent vs Provider vs Superadmin)
- Separate endpoints per user type:
  - `/user/auth/two-factor/*`
  - `/provider/auth/two-factor/*`
  - `/superadmin/auth/two-factor/*`

### 3.1 Create TwoFactorAuthService

**Files to Create:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/services/two-factor-auth.service.ts`
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/services/two-factor-auth.service.ts`
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/services/two-factor-auth.service.ts`

**Example Implementation (User module):**
```typescript
import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { EmailService } from '../../../common/email/email.service'
import { EmailTemplateService } from '../../../common/email-templates/email-template.service'

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name)
  private readonly CODE_EXPIRY_MINUTES = 15

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService
  ) {}

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Enable Email 2FA for user
   */
  async enableEmailTwoFactor(userId: string): Promise<void> {
    // Check if already enabled
    const existing = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    })

    if (existing?.enabled) {
      throw new BadRequestException('Two-factor authentication is already enabled')
    }

    // Create or update 2FA record
    await this.prisma.twoFactorAuth.upsert({
      where: { userId },
      create: {
        userId,
        method: 'email',
        enabled: true,
        enabledAt: new Date(),
      },
      update: {
        enabled: true,
        enabledAt: new Date(),
      },
    })

    this.logger.log(`Email 2FA enabled for user ${userId}`)
  }

  /**
   * Disable Email 2FA for user
   */
  async disableEmailTwoFactor(userId: string): Promise<void> {
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        enabled: false,
        enabledAt: null,
      },
    })

    // Delete any pending 2FA login verification codes
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        type: 'login_2fa',
        verified: false
      },
    })

    this.logger.log(`Email 2FA disabled for user ${userId}`)
  }

  /**
   * Get 2FA status for user
   */
  async getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean
    method: string | null
    enabledAt: Date | null
  }> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    })

    return {
      enabled: twoFactor?.enabled || false,
      method: twoFactor?.method || null,
      enabledAt: twoFactor?.enabledAt || null,
    }
  }

  /**
   * Create and send login verification code
   */
  async createAndSendLoginCode(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Delete any existing unverified 2FA login codes
    await this.prisma.emailVerification.deleteMany({
      where: {
        userId,
        type: 'login_2fa',
        verified: false
      },
    })

    // Generate new code
    const code = this.generateVerificationCode()
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES)

    // Save to database with type 'login_2fa'
    await this.prisma.emailVerification.create({
      data: {
        userId,
        code,
        type: 'login_2fa',  // Differentiate from signup verification
        expiresAt,
        ipAddress,
        userAgent,
      },
    })

    // Get user name for email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    })

    const userName = user?.firstName
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : 'there'

    // Send email with code
    const emailSent = await this.emailService.sendEmail({
      to: email,
      subject: 'Login Verification Code - World-Camps',
      html: this.emailTemplateService.getLoginVerificationTemplate(
        code,
        this.CODE_EXPIRY_MINUTES,
        userName
      ),
    })

    if (!emailSent) {
      this.logger.error(`Failed to send login verification email to ${email}`)
      throw new BadRequestException('Failed to send verification code. Please try again.')
    }

    this.logger.log(`Login verification code sent to ${email}`)
  }

  /**
   * Verify login code
   */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        userId,
        code,
        type: 'login_2fa',  // Only check 2FA login codes
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!verification) {
      throw new BadRequestException('Invalid verification code')
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      throw new BadRequestException('Verification code has expired. Please request a new one.')
    }

    // Mark as verified
    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { verified: true },
    })

    return true
  }
}
```

### 3.2 Create Email Template for Login Verification

**File:** `world-schools/apps/wc-nest-api/src/modules/common/email-templates/email-template.service.ts`

**Multi-App Considerations:**
- **Option A:** Single template with parameter for user type (e.g., `userType: 'parent' | 'provider' | 'superadmin'`)
- **Option B:** Separate methods for each user type with different branding:
  - `getParentLoginVerificationTemplate()`
  - `getProviderLoginVerificationTemplate()`
  - `getSuperadminLoginVerificationTemplate()`

**Recommended:** Option A for simplicity, unless branding differs significantly

Add new method for login verification email:
```typescript
getLoginVerificationTemplate(
  code: string,
  expiryMinutes: number,
  userName: string
): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Verification - World Camps</title>
  </head>
  <body style="margin:0;padding:0;background-color:${this.colors.backgroundGray};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <!-- Email content with verification code -->
    <p>Hi ${userName},</p>
    <p>We received a login attempt to your World-Camps account. Please use the verification code below to complete your login:</p>
    <div style="background-color:${this.colors.backgroundGray};padding:24px;border-radius:8px;text-align:center;margin:24px 0;">
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:${this.colors.primary};">${code}</div>
    </div>
    <p>This code will expire in ${expiryMinutes} minutes.</p>
    <p>If you didn't attempt to log in, please ignore this email or contact support if you're concerned about your account security.</p>
  </body>
  </html>`
}
```

### 3.3 Create 2FA Controller Endpoints

**Files to Update:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Parent endpoints)
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/auth.controller.ts` (Provider endpoints)
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/auth.controller.ts` (Superadmin endpoints)

**Endpoints to Create:**

**Parent (User) Endpoints:**
- `GET /user/auth/two-factor/status`
- `POST /user/auth/two-factor/enable`
- `POST /user/auth/two-factor/disable`
- `POST /user/auth/two-factor/send-code` (public)
- `POST /user/auth/two-factor/verify-code` (public)

**Provider Endpoints:**
- `GET /provider/auth/two-factor/status`
- `POST /provider/auth/two-factor/enable`
- `POST /provider/auth/two-factor/disable`
- `POST /provider/auth/two-factor/send-code` (public)
- `POST /provider/auth/two-factor/verify-code` (public)

**Superadmin Endpoints:**
- `GET /superadmin/auth/two-factor/status`
- `POST /superadmin/auth/two-factor/enable`
- `POST /superadmin/auth/two-factor/disable`
- `POST /superadmin/auth/two-factor/send-code` (public)
- `POST /superadmin/auth/two-factor/verify-code` (public)

**Example Implementation (User module):**
```typescript
import { TwoFactorAuthService } from './services/two-factor-auth.service'

// In constructor
constructor(
  // ... existing services
  private readonly twoFactorAuthService: TwoFactorAuthService
) {}

/**
 * Get 2FA status
 */
@Get('two-factor/status')
async getTwoFactorStatus(@CurrentUser() user: any) {
  return this.twoFactorAuthService.getTwoFactorStatus(user.id)
}

/**
 * Enable Email 2FA
 */
@Post('two-factor/enable')
async enableTwoFactor(@CurrentUser() user: any) {
  await this.twoFactorAuthService.enableEmailTwoFactor(user.id)
  return { message: 'Two-factor authentication enabled successfully' }
}

/**
 * Disable Email 2FA
 */
@Post('two-factor/disable')
async disableTwoFactor(@CurrentUser() user: any) {
  await this.twoFactorAuthService.disableEmailTwoFactor(user.id)
  return { message: 'Two-factor authentication disabled successfully' }
}

/**
 * Send login verification code (called during login if 2FA is enabled)
 */
@Public()
@Post('two-factor/send-code')
async sendLoginCode(
  @Body() body: { userId: string; email: string },
  @Req() request: Request
) {
  const ipAddress = request.ip
  const userAgent = request.headers['user-agent']

  await this.twoFactorAuthService.createAndSendLoginCode(
    body.userId,
    body.email,
    ipAddress,
    userAgent
  )

  return { message: 'Verification code sent to your email' }
}

/**
 * Verify login code
 */
@Public()
@Post('two-factor/verify-code')
async verifyLoginCode(@Body() body: { userId: string; code: string }) {
  const isValid = await this.twoFactorAuthService.verifyLoginCode(body.userId, body.code)
  return { verified: isValid }
}
```

### 3.4 Update Login Flow for 2FA

**Files to Update:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Parent login)
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/auth.controller.ts` (Provider login)
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/auth.controller.ts` (Superadmin login)

**Multi-App Considerations:**
- All three login endpoints need to check for 2FA status
- Same logic applies to all user types
- Frontend apps will handle 2FA verification UI separately

**Example Implementation (User module):**
```typescript
@Public()
@Post('login')
async login(@Body() loginDto: UserLoginDto, @Res({ passthrough: true }) response: Response) {
  // Validate credentials using central AuthService
  const result = await this.authService.login(loginDto)

  // ... existing role validation

  // Check if 2FA is enabled
  const twoFactorStatus = await this.twoFactorAuthService.getTwoFactorStatus(user.id)

  if (twoFactorStatus.enabled) {
    // Send verification code
    await this.twoFactorAuthService.createAndSendLoginCode(
      user.id,
      user.email,
      // Get IP and user agent from request
    )

    // Return special response indicating 2FA is required
    return {
      requiresTwoFactor: true,
      userId: user.id,
      email: user.email,
      message: 'Verification code sent to your email'
    }
  }

  // ... existing token setting logic (only if 2FA not required)
}
```

---

## Phase 4: Backend Implementation - Session Management

**Status:** 🔄 **PENDING** - Needs implementation for all user types

**Backend Modules:**
- 📱 User (`modules/user/auth/services`) - Parent session service
- 📱 Provider (`modules/provider/auth/services`) - Provider session service
- 📱 Superadmin (`modules/superadmin/auth/services`) - Superadmin session service

**Implementation Strategy:**
- **Option A (Recommended):** Create shared `SessionManagementService` in `modules/core/auth/services/` and import in all three modules
- **Option B:** Duplicate service in each module for better separation of concerns

**Multi-App Considerations:**
- All three user types share the same `UserSession` table
- Session isolation: Users can only see/revoke their own sessions
- Same session expiry (30 days) for all user types
- Separate endpoints per user type:
  - `/user/auth/sessions`
  - `/provider/auth/sessions`
  - `/superadmin/auth/sessions`

### 4.1 Create SessionManagementService

**Files to Create:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/services/session-management.service.ts`
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/services/session-management.service.ts`
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/services/session-management.service.ts`

**Example Implementation (User module):**
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import * as UAParser from 'ua-parser-js'

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name)
  private readonly SESSION_EXPIRY_DAYS = 30

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse user agent to extract device info
   */
  private parseUserAgent(userAgent: string): {
    deviceType: string
    deviceName: string
    browser: string
    os: string
  } {
    const parser = new UAParser(userAgent)
    const result = parser.getResult()

    const deviceType = result.device.type || 'desktop'
    const browser = result.browser.name || 'Unknown'
    const os = result.os.name || 'Unknown'
    const deviceName = `${browser} on ${os}`

    return { deviceType, deviceName, browser, os }
  }

  /**
   * Create new session
   * Returns the generated sessionId to be included in JWT payload
   */
  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    const deviceInfo = userAgent ? this.parseUserAgent(userAgent) : {
      deviceType: 'unknown',
      deviceName: 'Unknown Device',
      browser: 'Unknown',
      os: 'Unknown'
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_EXPIRY_DAYS)

    // Generate unique session ID (NOT the JWT token)
    const sessionId = crypto.randomUUID()

    await this.prisma.userSession.create({
      data: {
        userId,
        sessionId,  // Store session ID, not JWT
        ...deviceInfo,
        ipAddress,
        expiresAt,
      },
    })

    this.logger.log(`Session ${sessionId} created for user ${userId}`)

    // Return sessionId to be included in JWT payload
    return sessionId
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<any[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }, // Only non-expired sessions
        isRevoked: false,  // Only active (non-revoked) sessions
      },
      orderBy: {
        lastActiveAt: 'desc',
      },
    })

    return sessions.map(session => ({
      id: session.id,
      sessionId: session.sessionId,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location || 'Unknown',
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: currentSessionId ? session.sessionId === currentSessionId : false,
    }))
  }

  /**
   * Update session last active time
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { sessionId },
      data: { lastActiveAt: new Date() },
    })
  }

  /**
   * Revoke specific session (soft delete - mark as revoked)
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        sessionId,
        userId, // Ensure user owns this session
      },
      data: {
        isRevoked: true,
      },
    })

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`)
  }

  /**
   * Revoke all other sessions (except current)
   */
  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        sessionId: { not: currentSessionId },
        isRevoked: false,  // Only revoke active sessions
      },
      data: {
        isRevoked: true,
      },
    })

    this.logger.log(`All other sessions revoked for user ${userId}`)
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    this.logger.log(`Cleaned up ${result.count} expired sessions`)
  }
}
```

### 4.2 Create Session Controller Endpoints

**Files to Update:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Parent endpoints)
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/auth.controller.ts` (Provider endpoints)
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/auth.controller.ts` (Superadmin endpoints)

**Endpoints to Create:**

**Parent (User) Endpoints:**
- `GET /user/auth/sessions`
- `DELETE /user/auth/sessions/:sessionId`
- `POST /user/auth/sessions/revoke-all-others`

**Provider Endpoints:**
- `GET /provider/auth/sessions`
- `DELETE /provider/auth/sessions/:sessionId`
- `POST /provider/auth/sessions/revoke-all-others`

**Superadmin Endpoints:**
- `GET /superadmin/auth/sessions`
- `DELETE /superadmin/auth/sessions/:sessionId`
- `POST /superadmin/auth/sessions/revoke-all-others`

**Example Implementation (User module):**
```typescript
import { SessionManagementService } from './services/session-management.service'

// In constructor
constructor(
  // ... existing services
  private readonly sessionManagementService: SessionManagementService
) {}

/**
 * Get all active sessions
 */
@Get('sessions')
async getSessions(@CurrentUser() user: any) {
  // Extract sessionId from JWT payload (user object contains decoded JWT)
  const currentSessionId = user.sessionId
  return this.sessionManagementService.getUserSessions(user.id, currentSessionId)
}

/**
 * Revoke specific session
 */
@Delete('sessions/:sessionId')
async revokeSession(
  @CurrentUser() user: any,
  @Param('sessionId') sessionId: string
) {
  await this.sessionManagementService.revokeSession(user.id, sessionId)
  return { message: 'Session revoked successfully' }
}

/**
 * Revoke all other sessions
 */
@Post('sessions/revoke-all-others')
async revokeAllOtherSessions(@CurrentUser() user: any) {
  // Extract current sessionId from JWT payload
  const currentSessionId = user.sessionId

  await this.sessionManagementService.revokeAllOtherSessions(user.id, currentSessionId)
  return { message: 'All other sessions revoked successfully' }
}
```

### 4.3 Update Login to Create Session

**Files to Update:**
- `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Parent login)
- `world-schools/apps/wc-nest-api/src/modules/provider/auth/auth.controller.ts` (Provider login)
- `world-schools/apps/wc-nest-api/src/modules/superadmin/auth/auth.controller.ts` (Superadmin login)

**Multi-App Considerations:**
- All three login endpoints need to create session records
- Same session creation logic for all user types
- Include `sessionId` in JWT payload for all user types

**Example Implementation (User module):**
```typescript
@Public()
@Post('login')
async login(
  @Body() loginDto: UserLoginDto,
  @Res({ passthrough: true }) response: Response,
  @Req() request: Request
) {
  // ... existing login logic (validate credentials, check 2FA, etc.)

  // After successful login (and 2FA if enabled)
  // Create session record FIRST
  const userAgent = request.headers['user-agent']
  const ipAddress = request.ip

  const sessionId = await this.sessionManagementService.createSession(
    user.id,
    userAgent,
    ipAddress
  )

  // Generate JWT with sessionId in payload
  const payload = {
    id: user.id,
    email: user.email,
    role: 'user',
    sessionId,  // Include sessionId in JWT payload
  }

  const accessToken = this.jwtService.sign(payload)
  const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' })

  // Set cookies
  response.cookie('wc_user_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  })

  // ... rest of login logic
}
```

**Important:** The `sessionId` must be included in the JWT payload so it can be extracted later for session management operations.

---

## Phase 5: Frontend Implementation - Security Settings Page

**Status:** 🔄 **PENDING** - Needs implementation for all three apps

**Frontend Apps:**
- 📱 wc-booking (Parent portal)
- 📱 wc-provider (Provider portal)
- 📱 wc-superadmin (Superadmin portal)

**Implementation Strategy:**
- Each app needs its own Security Settings page
- **Recommended:** Create shared components in `@world-schools/ui-web` for:
  - Password change modal
  - 2FA toggle component
  - Session list component
  - Session card component
- Each app imports and uses these shared components
- App-specific styling and branding can be applied via props

**Multi-App Considerations:**
- Same UI/UX across all three apps for consistency
- Different API endpoints per app (user/provider/superadmin)
- May need different navigation paths per app
- Component sharing reduces duplication and maintenance

### 5.1 Create Security Settings Page

**Files to Create:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/account/settings/security/page.tsx` (Parent)
- `world-schools/apps/wc-provider/src/app/(dashboard)/account/settings/security/page.tsx` (Provider)
- `world-schools/apps/wc-superadmin/src/app/(dashboard)/account/settings/security/page.tsx` (Superadmin)

**Example Implementation (wc-booking - Parent portal):**
```typescript
'use client'

import React, { useEffect, useState } from 'react'
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react'
import { Eye, EyeOff, Monitor, Smartphone, Check, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@world-schools/ui-web'
import { ProtectedRoute } from '@/components/auth/protected-route'
import {
  validatePassword,
  getPasswordStrengthLabel,
  getPasswordStrengthHeroColor,
  PasswordRequirementsDisplay,
} from '@world-schools/wc-frontend-utils'
import { Progress } from '@heroui/react'

interface TwoFactorStatus {
  enabled: boolean
  method: string | null
  enabledAt: Date | null
}

interface Session {
  id: string
  deviceType: string
  deviceName: string
  browser: string
  os: string
  ipAddress: string
  location: string
  lastActiveAt: string
  createdAt: string
}

const SecuritySettingsPage = () => {
  const { user } = useAuthStore()

  // Password state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)

  // 2FA state
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null)
  const [is2FALoading, setIs2FALoading] = useState(false)

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([])
  const [isSessionsLoading, setIsSessionsLoading] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadTwoFactorStatus()
    loadSessions()
  }, [])

  const loadTwoFactorStatus = async () => {
    // API call to get 2FA status
  }

  const loadSessions = async () => {
    // API call to get active sessions
  }

  const handlePasswordChange = async () => {
    // Password change logic (similar to existing implementation)
  }

  const handleToggle2FA = async () => {
    // Enable/disable 2FA
  }

  const handleRevokeSession = async (sessionId: string) => {
    // Revoke specific session
  }

  const handleRevokeAllOtherSessions = async () => {
    // Revoke all other sessions
  }

  return (
    <ProtectedRoute requireAuth={true}>
      <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
        {/* Page Header */}
        <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
          <div className="h-20 px-10 mb-2 flex items-center border-b border-gray-200 dark:border-gray-700/50">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Login & security</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
          {/* Password Section */}
          {/* 2FA Section */}
          {/* Active Sessions Section */}
          {/* Account & Privacy Link */}
        </div>
      </div>

      {/* Change Password Modal */}
      {/* ... modal implementation */}
    </ProtectedRoute>
  )
}

export default SecuritySettingsPage
```

---

## Phase 6: Frontend Services & API Integration

**Status:** 🔄 **PENDING** - Needs implementation for all three apps

**Frontend Apps:**
- 📱 wc-booking (Parent portal) - Calls `/user/auth/*` endpoints
- 📱 wc-provider (Provider portal) - Calls `/provider/auth/*` endpoints
- 📱 wc-superadmin (Superadmin portal) - Calls `/superadmin/auth/*` endpoints

**Implementation Strategy:**
- Each app needs its own security services file
- Same function signatures across all apps
- Only difference is the API endpoint prefix (user/provider/superadmin)
- **Recommended:** Create a shared service factory or base class to reduce duplication

**Multi-App Considerations:**
- All three apps call the same backend, just different endpoints
- Same request/response types across all apps
- Can share TypeScript interfaces via `@world-schools/wc-frontend-utils`

### 6.1 Create Security Services

**Files to Create:**
- `world-schools/apps/wc-booking/src/services/security.services.ts` (Parent - calls `/user/auth/*`)
- `world-schools/apps/wc-provider/src/services/security.services.ts` (Provider - calls `/provider/auth/*`)
- `world-schools/apps/wc-superadmin/src/services/security.services.ts` (Superadmin - calls `/superadmin/auth/*`)

**Example Implementation (wc-booking - Parent portal):**
```typescript
import apiClient from '@/utils/api-client'

/**
 * Get 2FA status
 */
export async function getTwoFactorStatus() {
  return apiClient.get('user/auth/two-factor/status')
}

/**
 * Enable Email 2FA
 */
export async function enableTwoFactor() {
  return apiClient.post('user/auth/two-factor/enable', {})
}

/**
 * Disable Email 2FA
 */
export async function disableTwoFactor() {
  return apiClient.post('user/auth/two-factor/disable', {})
}

/**
 * Get all active sessions
 */
export async function getSessions() {
  return apiClient.get('user/auth/sessions')
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string) {
  return apiClient.delete(`user/auth/sessions/${sessionId}`)
}

/**
 * Revoke all other sessions
 */
export async function revokeAllOtherSessions() {
  return apiClient.post('user/auth/sessions/revoke-all-others', {})
}
```

---

## Phase 7: Code Standards & Patterns

**Status:** 🔄 **PENDING** - Applies to all three apps

**Affects:** 🔄 All frontend apps (wc-booking, wc-provider, wc-superadmin)

**Multi-App Considerations:**
- Same code standards apply to all three apps
- Consistent styling and patterns across all portals
- Shared components should follow the same patterns
- TypeScript types can be shared via `@world-schools/wc-frontend-utils`

### 7.1 Styling Consistency
- Follow Account Hub page styling patterns (consistent across all apps)
- Use `mb-6` for section spacing
- Use `p-6` for card padding
- Use `rounded-2xl` for card borders
- Use `text-slate-500` for secondary text
- Use `text-slate-400` for tertiary text
- **Note:** Provider and Superadmin portals may have different color schemes but should follow same spacing/sizing patterns

### 7.2 Component Patterns
- Use HeroUI v2.8.7 components (Button, Modal, Input, Progress)
- Use Tailwind CSS v4 utility classes
- Follow existing password change implementation patterns
- Use ProtectedRoute wrapper for authentication (all apps)
- **Recommended:** Create shared components in `@world-schools/ui-web` for reusability

### 7.3 Error Handling
- Display user-friendly error messages (consistent across all apps)
- Clear errors when user starts typing
- Show success messages with auto-dismiss (5 seconds)
- Log errors to console for debugging
- **Note:** Error messages should be user-type-agnostic

### 7.4 TypeScript Types
- Create interfaces for all data structures
- Use strict type safety throughout
- Export types for reusability
- **Recommended:** Share common types via `@world-schools/wc-frontend-utils`:
  - `TwoFactorStatus`
  - `Session`
  - `SecuritySettings`
  - API request/response types

---

## Phase 8: Testing Considerations

**Status:** 🔄 **PENDING** - Applies to all three apps

**Affects:** 🔄 All apps (backend + all three frontends)

**Multi-App Testing Strategy:**
- Backend tests cover all user types
- Frontend tests needed for each app separately
- E2E tests should cover all three user types

### 8.1 Backend Tests

**Unit Tests:**
- TwoFactorAuthService (test for all three modules: user/provider/superadmin)
- SessionManagementService (test for all three modules: user/provider/superadmin)
- Test service logic independently of controllers

**Integration Tests:**
- 2FA login flow for Parent users (`/user/auth/*`)
- 2FA login flow for Provider users (`/provider/auth/*`)
- 2FA login flow for Superadmin users (`/superadmin/auth/*`)
- Session management endpoints for all three user types
- **Session isolation:** Verify users can only see/revoke their own sessions
- **Cross-user-type isolation:** Verify Parent sessions don't appear in Provider/Superadmin lists

### 8.2 Frontend Tests

**Component Tests (per app):**
- Security Settings page for wc-booking
- Security Settings page for wc-provider
- Security Settings page for wc-superadmin
- Test password change modal (can use shared component tests if component is shared)
- Test 2FA enable/disable flow
- Test session revocation

**Shared Component Tests:**
- If components are shared via `@world-schools/ui-web`, create tests in the shared library
- Test components with different props/configurations

### 8.3 E2E Tests

**Per User Type:**
- Complete security settings workflow for Parent users (wc-booking)
- Complete security settings workflow for Provider users (wc-provider)
- Complete security settings workflow for Superadmin users (wc-superadmin)
- Password change flow (all user types)
- 2FA setup and login flow (all user types)
- Session management flow (all user types)

**Cross-User-Type Tests:**
- Verify session isolation between user types
- Verify 2FA settings are independent per user type

---

## Phase 9: Security Considerations

**Status:** 🔄 **PENDING** - Applies to all user types

**Affects:** 🔄 All apps (backend + all three frontends)

**Multi-App Security Notes:**
- Same security standards apply to all three user types
- Session isolation is critical - users must only see/manage their own sessions
- 2FA settings are per-user, not per-user-type

### 9.1 Password Security
- Use bcrypt with configurable salt rounds (already implemented, shared across all user types)
- Validate password strength on both frontend and backend (all apps)
- Never log or expose passwords
- Update `passwordChangedAt` timestamp on every password change (all user types)
- **Multi-App Note:** Same password requirements for all user types

### 9.2 2FA Security
- Use 6-digit codes with 15-minute expiry (all user types)
- Generate cryptographically secure random codes
- Delete old unverified codes before creating new ones
- Rate limit code generation to prevent abuse (per user, not per user-type)
- Send codes only to verified email addresses
- **Multi-App Note:** 2FA is per-user, not per-user-type (a user can only have one 2FA setting)

### 9.3 Session Security
- **DO NOT store JWT tokens in database** - use separate session IDs instead
- Generate unique `sessionId` (UUID) for each login (all user types)
- Include `sessionId` in JWT payload as a custom claim
- Set appropriate session expiry (30 days for all user types)
- Track device info and IP address for security monitoring
- Allow users to revoke sessions remotely (soft delete with `isRevoked` flag)
- Clean up expired sessions periodically
- **Validate session ownership before revocation** - critical for multi-app security
- On sensitive operations, optionally validate that the session is not revoked
- **Multi-App Note:** Sessions are isolated per user - a Parent user cannot see Provider/Superadmin sessions

**Why separate session IDs?**
- JWTs are designed to be stateless and self-contained
- Storing JWTs in database defeats their purpose
- Separate session IDs allow session management without storing sensitive tokens
- Reduces attack surface - database breach doesn't expose active JWTs
- Enables session revocation without invalidating the JWT structure

**Session Isolation:**
- Each user can only see/revoke their own sessions
- Backend must validate `userId` matches the authenticated user
- Frontend apps call different endpoints but backend enforces same isolation rules

### 9.4 API Security
- Require authentication for all security endpoints (except login) - all user types
- **Validate user ownership of resources** (sessions, 2FA settings) - critical for multi-app security
- Use HTTPS for all communications
- Implement rate limiting on sensitive endpoints (per user, not per user-type)
- Log security-related events for audit trail (include user type in logs)
- **Multi-App Note:** Ensure endpoint authorization checks user type (Parent can't call Provider endpoints)

---

## Phase 10: Dependencies

**Status:** 🔄 **PENDING** - Dependencies apply to all apps

**Multi-App Notes:**
- Backend dependencies are shared (installed once in wc-nest-api)
- Frontend dependencies needed in all three apps (wc-booking, wc-provider, wc-superadmin)

### 10.1 New NPM Packages

**Backend (wc-nest-api):**
- `ua-parser-js` - For parsing user agent strings (session management)

Install command:
```bash
cd world-schools/apps/wc-nest-api
npm install ua-parser-js
npm install --save-dev @types/ua-parser-js
```

**Frontend (all three apps):**
- No new packages required (all dependencies already available)

### 10.2 Existing Dependencies

**Backend (wc-nest-api):**
- `bcryptjs` - Password hashing (shared across all user types)
- `@nestjs/jwt` - JWT handling (shared across all user types)
- `nodemailer` - Email sending (shared across all user types)
- `@prisma/client` - Database access (shared across all user types)

**Frontend (wc-booking, wc-provider, wc-superadmin):**
- `@heroui/react` v2.8.7 - UI components (all apps)
- `lucide-react` - Icons (all apps)
- `@world-schools/wc-frontend-utils` - Password validation utilities (all apps)
- `@world-schools/ui-web` - Shared UI components (all apps, if using shared components)

---

## Phase 11: Implementation Sequence

**Multi-App Implementation Timeline:**
- Backend work is shared across all user types
- Frontend work needs to be done for each app separately
- **Recommended:** Implement for one app first (wc-booking), then replicate to others

### Step 1: Database Setup (Day 1) ✅ COMPLETE
1. ✅ Update Prisma schema with all new models
2. ✅ Run migration
3. ✅ Verify database changes

**Status:** Complete - affects all user types

### Step 2: Backend - Password Enhancement (Day 1) ✅ COMPLETE
1. ✅ Update AuthService.changePassword (shared)
2. ✅ Update User profile endpoint
3. ✅ Update Provider profile endpoint
4. ✅ Update Superadmin profile endpoint
5. ✅ Update User registration endpoint
6. ✅ Update Provider registration endpoint
7. ✅ Update PasswordResetService
8. ✅ Test password change with timestamp (all user types)

**Status:** Complete - all user types implemented

### Step 3: Backend - 2FA (Day 2-4) 🔄 PENDING
1. Create TwoFactorAuthService (user/provider/superadmin modules)
2. Create email template for login verification (may need user-type-specific branding)
3. Add 2FA controller endpoints (user/provider/superadmin controllers)
4. Update login flow for 2FA check (all three login endpoints)
5. Test 2FA enable/disable (all user types)
6. Test 2FA login flow (all user types)

**Multi-App Notes:**
- Consider creating shared service in `core/auth/services/` to reduce duplication
- Test each user type's endpoints separately
- Verify 2FA isolation (each user has independent 2FA settings)

### Step 4: Backend - Session Management (Day 4-6) 🔄 PENDING
1. Install ua-parser-js package
2. Create SessionManagementService (user/provider/superadmin modules)
3. Add session controller endpoints (user/provider/superadmin controllers)
4. Update login to create sessions (all three login endpoints)
5. Test session tracking (all user types)
6. Test session revocation (all user types)
7. **Test session isolation** (users can only see/revoke their own sessions)

**Multi-App Notes:**
- Consider creating shared service in `core/auth/services/` to reduce duplication
- Critical: Test session isolation between user types
- Verify users can't access other user types' sessions

### Step 5: Frontend - Security Page (Day 6-9) 🔄 PENDING

**5a: wc-booking (Parent Portal) - Day 6-7**
1. Create Security Settings page component
2. Implement password change modal
3. Implement 2FA toggle UI
4. Implement sessions list UI
5. Add Account & Privacy link
6. Test all functionality

**5b: wc-provider (Provider Portal) - Day 7-8**
1. Create Security Settings page component (copy from wc-booking)
2. Update API endpoints to use `/provider/auth/*`
3. Test all functionality

**5c: wc-superadmin (Superadmin Portal) - Day 8-9**
1. Create Security Settings page component (copy from wc-booking)
2. Update API endpoints to use `/superadmin/auth/*`
3. Test all functionality

**Optimization:** Create shared components in `@world-schools/ui-web` to reduce duplication

### Step 6: Frontend - Services (Day 9-10) 🔄 PENDING

**6a: wc-booking - Day 9**
1. Create security.services.ts (calls `/user/auth/*`)
2. Integrate with backend APIs
3. Test all API calls

**6b: wc-provider - Day 9**
1. Create security.services.ts (calls `/provider/auth/*`)
2. Integrate with backend APIs
3. Test all API calls

**6c: wc-superadmin - Day 10**
1. Create security.services.ts (calls `/superadmin/auth/*`)
2. Integrate with backend APIs
3. Test all API calls

### Step 7: Testing & Polish (Day 10-12) 🔄 PENDING
1. Write unit tests (backend - all user types)
2. Write integration tests (backend - all user types)
3. Write component tests (frontend - all three apps)
4. Write E2E tests (all three apps)
5. Manual testing of all flows (all user types)
6. Test session isolation
7. Fix bugs and edge cases
8. Polish UI/UX (all three apps)

### Step 8: Documentation (Day 12) 🔄 PENDING
1. Update API documentation (document all three endpoint sets)
2. Add inline code comments
3. Create user guide for 2FA setup (may need user-type-specific guides)
4. Document multi-app architecture decisions

---

## Phase 12: Verification Checklist

**Multi-App Verification:** All items must be verified for all three user types (Parent, Provider, Superadmin) unless specified otherwise.

### Database
- [x] All new tables created successfully (shared across all user types)
- [x] All relations properly defined
- [x] Indexes added for performance
- [x] Migration runs without errors

### Backend - Password (All User Types)
- [x] Password change updates `passwordChangedAt` (User/Provider/Superadmin)
- [x] Profile endpoint returns `passwordChangedAt` (User/Provider/Superadmin)
- [x] Registration sets `passwordChangedAt` (User/Provider)
- [x] Password reset sets `passwordChangedAt` (all user types)
- [ ] Timestamp displayed correctly in frontend (wc-booking/wc-provider/wc-superadmin)

### Backend - 2FA (All User Types)
- [ ] 2FA can be enabled/disabled (User endpoints)
- [ ] 2FA can be enabled/disabled (Provider endpoints)
- [ ] 2FA can be enabled/disabled (Superadmin endpoints)
- [ ] Login verification codes sent via email (all user types)
- [ ] Codes expire after 15 minutes (all user types)
- [ ] Invalid codes rejected (all user types)
- [ ] Login flow checks 2FA status (User/Provider/Superadmin login)
- [ ] 2FA required before issuing tokens (all user types)
- [ ] 2FA settings are per-user (not per-user-type)

### Backend - Sessions (All User Types)
- [ ] Sessions created on login (User/Provider/Superadmin)
- [ ] Device info parsed correctly (all user types)
- [ ] Sessions list returned for user (User endpoints)
- [ ] Sessions list returned for user (Provider endpoints)
- [ ] Sessions list returned for user (Superadmin endpoints)
- [ ] Individual sessions can be revoked (all user types)
- [ ] All other sessions can be revoked (all user types)
- [ ] Expired sessions cleaned up (all user types)
- [ ] **Session isolation:** Users can only see their own sessions
- [ ] **Cross-user-type isolation:** Parent sessions don't appear in Provider/Superadmin lists

### Frontend - wc-booking (Parent Portal)
- [ ] Security Settings page renders correctly
- [ ] Password change modal works
- [ ] Password strength indicator shows
- [ ] Password requirements display
- [ ] 2FA toggle works
- [ ] Sessions list displays
- [ ] Session revocation works
- [ ] Account & Privacy link navigates correctly
- [ ] Error messages display properly
- [ ] Success messages display properly
- [ ] Loading states work correctly
- [ ] Calls correct API endpoints (`/user/auth/*`)

### Frontend - wc-provider (Provider Portal)
- [ ] Security Settings page renders correctly
- [ ] Password change modal works
- [ ] Password strength indicator shows
- [ ] Password requirements display
- [ ] 2FA toggle works
- [ ] Sessions list displays
- [ ] Session revocation works
- [ ] Account & Privacy link navigates correctly
- [ ] Error messages display properly
- [ ] Success messages display properly
- [ ] Loading states work correctly
- [ ] Calls correct API endpoints (`/provider/auth/*`)

### Frontend - wc-superadmin (Superadmin Portal)
- [ ] Security Settings page renders correctly
- [ ] Password change modal works
- [ ] Password strength indicator shows
- [ ] Password requirements display
- [ ] 2FA toggle works
- [ ] Sessions list displays
- [ ] Session revocation works
- [ ] Account & Privacy link navigates correctly
- [ ] Error messages display properly
- [ ] Success messages display properly
- [ ] Loading states work correctly
- [ ] Calls correct API endpoints (`/superadmin/auth/*`)

### Security (All User Types)
- [ ] Passwords hashed with bcrypt (all user types)
- [ ] 2FA codes cryptographically secure (all user types)
- [ ] Session tokens validated (all user types)
- [ ] **User ownership validated** (critical for multi-app security)
- [ ] **Session isolation enforced** (users can only see/revoke own sessions)
- [ ] **Endpoint authorization** (Parent can't call Provider/Superadmin endpoints)
- [ ] Rate limiting implemented (per user, not per user-type)
- [ ] HTTPS enforced (all apps)
- [ ] Security events logged (include user type in logs)

### Code Quality (All Apps)
- [ ] TypeScript strict mode passes (backend + all frontends)
- [ ] No linting errors (backend + all frontends)
- [ ] Code follows existing patterns (all apps)
- [ ] Proper error handling (all apps)
- [ ] Comprehensive logging (backend)
- [ ] Code documented (all apps)
- [ ] Shared components properly abstracted (if using `@world-schools/ui-web`)

### Testing (All User Types)
- [ ] Unit tests for backend services (all modules)
- [ ] Integration tests for all endpoints (User/Provider/Superadmin)
- [ ] Component tests for all frontends (wc-booking/wc-provider/wc-superadmin)
- [ ] E2E tests for all user types
- [ ] Session isolation tests
- [ ] Cross-user-type isolation tests

---

## Notes

- **Multi-App Architecture:** This implementation covers all three frontend applications (wc-booking, wc-provider, wc-superadmin) that share the same backend authentication system (wc-nest-api)
- **Security Feature Parity:** All three user types (Parent, Provider, Superadmin) receive the same security features
- **Shared Backend:** Core authentication logic is shared across all user types via `modules/core/auth`
- **User-Type-Specific Endpoints:** Each user type has parallel API endpoints (`/user/auth/*`, `/provider/auth/*`, `/superadmin/auth/*`)
- **Session Isolation:** Critical security requirement - users can only see/revoke their own sessions, no cross-user-type access
- **HeroUI Version:** Use v2.8.7 (NOT v3) for all frontend apps
- **Tailwind CSS:** Use v4 syntax for all frontend apps
- **Email 2FA Only:** Do NOT implement Authenticator App 2FA
- **Session Tracking:** Use separate `sessionId` (UUID) for session tracking, NOT JWT tokens
- **Location Data:** IP-to-location lookup can be added later (optional enhancement)
- **Migration Path:** Move existing password change from Personal Info page to Security Settings page (all apps)
- **Backward Compatibility:** Not required (app in initial development phase)
- **Component Sharing:** Recommended to create shared components in `@world-schools/ui-web` to reduce duplication across apps

---

## Future Enhancements (Out of Scope)

1. **IP Geolocation:** Add IP-to-location service for accurate location display
2. **Authenticator App 2FA:** Add TOTP-based 2FA as alternative to email
3. **Backup Codes:** Generate one-time backup codes for 2FA recovery
4. **Security Alerts:** Email notifications for suspicious login attempts
5. **Login History:** Full audit log of all login attempts
6. **Device Trust:** Remember trusted devices to skip 2FA
7. **Biometric Authentication:** WebAuthn/FIDO2 support
8. **Password History:** Prevent reuse of recent passwords
9. **Account Recovery:** Alternative recovery methods if email is compromised
10. **Security Score:** Overall account security rating with recommendations
