# Provider Authentication Setup

This document describes the provider authentication system implementation for the wc-nest-api application.

## Overview

The provider authentication system provides complete authentication flows for provider users, including:
- Email-based signup with verification
- Email verification using 6-digit codes
- Login with email verification check
- Token refresh
- Password management
- Profile access
- Logout

## Features

### 1. Email-Based Signup
- Providers register with email, password, and organization details
- System automatically creates user account and provider organization
- Assigns "Provider Admin" role to the user
- Sends 6-digit verification code to email
- User account is created but email is marked as unverified

### 2. Email Verification
- 6-digit verification codes sent via email
- Codes expire after 15 minutes
- Users can resend codes (max 5 attempts per hour)
- Email must be verified before login is allowed

### 3. Secure Authentication
- JWT-based authentication with access and refresh tokens
- HTTP-only cookies for token storage (recommended)
- Optional header-based authentication for development
- Role-based access control (Provider Admin or provider-specific roles)

## API Endpoints

All endpoints are prefixed with `/provider/auth/`:

### Public Endpoints (No Authentication Required)

#### 1. Register Provider
```
POST /provider/auth/register
```

**Request Body:**
```json
{
  "email": "owner@schoolname.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "providerName": "ABC International School",
  "providerPhone": "+1-555-123-4567",
  "providerEmail": "contact@abcschool.com",
  "providerAddress": "123 School Street",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "United States",
  "website": "https://abcschool.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Registration successful. Please check your email for verification code.",
    "user": {
      "id": "uuid",
      "email": "owner@schoolname.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": false
    },
    "provider": {
      "id": "uuid",
      "name": "ABC International School"
    }
  }
}
```

#### 2. Verify Email
```
POST /provider/auth/verify-email
```

**Request Body:**
```json
{
  "email": "owner@schoolname.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully. You can now login."
  }
}
```

#### 3. Resend Verification Code
```
POST /provider/auth/resend-verification-code
```

**Request Body:**
```json
{
  "email": "owner@schoolname.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Verification code sent successfully. Please check your email."
  }
}
```

#### 4. Login
```
POST /provider/auth/login
```

**Request Body:**
```json
{
  "email": "owner@schoolname.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "owner@schoolname.com",
      "first_name": "John",
      "last_name": "Doe",
      "roles": [...],
      "permissions": [...]
    }
  }
}
```

**Note:** Tokens are set in HTTP-only cookies. If email is not verified, login will fail with 401 error.

#### 5. Refresh Token
```
POST /provider/auth/refresh
```

**Request Body (optional if using cookies):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "expiresIn": 900
  }
}
```

### Protected Endpoints (Authentication Required)

#### 6. Get Profile
```
GET /provider/auth/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "owner@schoolname.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": [...],
    "permissions": [...]
  }
}
```

#### 7. Change Password
```
PATCH /provider/auth/change-password
```

**Request Body:**
```json
{
  "oldPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": null
}
```

#### 8. Logout
```
POST /provider/auth/logout
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

## Database Schema

### User Model Updates
```prisma
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  passwordHash    String?  @map("password_hash")
  firstName       String?  @map("first_name")
  lastName        String?  @map("last_name")
  emailVerified   Boolean  @default(false) @map("email_verified")
  emailVerifiedAt DateTime? @map("email_verified_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  emailVerifications EmailVerification[]
  // ... other relations
}
```

### EmailVerification Model
```prisma
model EmailVerification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  code      String
  expiresAt DateTime @map("expires_at")
  verified  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([code])
  @@map("email_verifications")
}
```

## Email Configuration

Add these environment variables to your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@worldschools.com
```

## Security Features

1. **Email Verification Required**: Users cannot login until email is verified
2. **Code Expiration**: Verification codes expire after 15 minutes
3. **Rate Limiting**: Maximum 5 verification code requests per hour
4. **HTTP-Only Cookies**: Tokens stored in HTTP-only cookies (not accessible to JavaScript)
5. **Role-Based Access**: Only users with Provider Admin or provider-specific roles can access endpoints
6. **Password Hashing**: Passwords hashed using bcrypt with configurable salt rounds

## Global Utils Package

A new `@world-schools/global-utils` package has been created to share common utilities across the monorepo:

### EmailService
- Sends emails using nodemailer
- Supports HTML content
- Configurable SMTP settings
- Error handling and logging

**Usage:**
```typescript
import { EmailService } from '@world-schools/global-utils'

// In your module
@Module({
  providers: [
    {
      provide: EmailService,
      useFactory: (configService: ConfigService) => {
        return new EmailService(configService.emailConfig)
      },
      inject: [ConfigService],
    },
  ],
})
export class YourModule {}
```

## Testing the Implementation

### 1. Register a Provider
```bash
curl -X POST http://localhost:3000/provider/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "firstName": "Test",
    "lastName": "User",
    "providerName": "Test School"
  }'
```

### 2. Check Email for Verification Code
Check the email inbox for the 6-digit code.

### 3. Verify Email
```bash
curl -X POST http://localhost:3000/provider/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

### 4. Login
```bash
curl -X POST http://localhost:3000/provider/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }' \
  -c cookies.txt
```

### 5. Access Protected Endpoint
```bash
curl -X GET http://localhost:3000/provider/auth/profile \
  -b cookies.txt
```

## Error Handling

Common error responses:

### Email Not Verified
```json
{
  "statusCode": 401,
  "message": "Email not verified. Please verify your email before logging in.",
  "error": "Unauthorized"
}
```

### Invalid Verification Code
```json
{
  "statusCode": 400,
  "message": "Invalid verification code",
  "error": "Bad Request"
}
```

### Code Expired
```json
{
  "statusCode": 400,
  "message": "Verification code has expired. Please request a new one.",
  "error": "Bad Request"
}
```

### Too Many Attempts
```json
{
  "statusCode": 400,
  "message": "Too many verification attempts. Please try again later.",
  "error": "Bad Request"
}
```

## Next Steps

1. **Frontend Integration**: Implement signup and verification flows in wc-provider frontend
2. **Email Templates**: Customize email templates with branding
3. **SMS Verification**: Add optional SMS verification as alternative
4. **Password Reset**: Implement forgot password flow with email verification
5. **Two-Factor Authentication**: Add optional 2FA for enhanced security


