# WC-Booking Authentication Login Flow Audit

**Date:** 2026-02-22  
**Application:** wc-booking (Parent/User Portal)  
**Scope:** Frontend and Backend Authentication Flows

---

## 1. Executive Summary

This audit reviews the authentication login flows for the wc-booking application, covering both simple login and 2FA-enabled login scenarios across cookie-based and request-based authentication modes.

### Key Findings Summary

- ✅ **2FA Flow Implementation**: Correctly implemented with `EmailVerification` table using `type: 'login_2fa'`
- ✅ **Session Management**: Properly creates sessions before token generation in both flows
- ✅ **Token Isolation**: Uses app-specific cookies (`wc_user_access_token`, `wc_user_refresh_token`)
- ✅ **Dual Auth Mode Support**: Supports both cookie-based and request-based authentication
- ❌ **CRITICAL**: Missing `sessionId` in tokens for several authentication endpoints
- ❌ **HIGH**: Inconsistent session creation across authentication flows
- ⚠️ **MEDIUM**: 2FA resend endpoint uses incorrect endpoint path in frontend

### Overall Assessment

The authentication system is **mostly functional** but has **critical gaps** in session management consistency that could lead to security issues and session tracking problems.

---

## 2. Simple Login Flow Analysis

### Flow Steps

1. **User submits credentials** → `POST /user/auth/login`
2. **Backend validates credentials** → `AuthService.login()`
3. **Backend checks 2FA status** → `TwoFactorAuthService.getTwoFactorStatus()`
4. **If 2FA disabled:**
   - Creates session record → `SessionManagementService.createSession()`
   - Generates JWT tokens with `sessionId` → `AuthService.generateTokensFromUser(user, 'user', sessionId)`
   - Sets HTTP-only cookies (`wc_user_access_token`, `wc_user_refresh_token`)
   - Returns user data
5. **Frontend updates auth state** → `useAuthStore.login()`
6. **Frontend redirects** → `/` (home page)

### Code Review

#### Backend: `auth.controller.ts` (Lines 230-337)

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts" mode="EXCERPT">
````typescript
// Check if 2FA is enabled
const twoFactorStatus = await this.twoFactorAuthService.getTwoFactorStatus(user.id)

if (twoFactorStatus.enabled) {
  // ... 2FA flow
}

// Create session record FIRST (before generating JWT)
const userAgent = request.headers['user-agent']
const ipAddress = request.ip

const sessionId = await this.sessionManagementService.createSession(
  user.id,
  userAgent,
  ipAddress
)

// Generate app-specific tokens with 'user' claim and sessionId for token isolation
const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)
````
</augment_code_snippet>

✅ **Correct**: Session created before token generation  
✅ **Correct**: `sessionId` included in JWT payload  
✅ **Correct**: App-specific cookies set with proper security flags

#### Frontend: `signin/page.tsx` (Lines 48-78)

<augment_code_snippet path="world-schools/apps/wc-booking/src/app/auth/signin/page.tsx" mode="EXCERPT">
````typescript
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault()
  if (!validateForm()) return
  clearError()

  // Use auth store's login method - single API call
  const result = await login(formData)

  // Check if result is a success response with requiresTwoFactor flag
  if (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    result.success &&
    'data' in result &&
    result.data &&
    typeof result.data === 'object' &&
    'requiresTwoFactor' in result.data &&
    result.data.requiresTwoFactor === true
  ) {
    // Redirect to 2FA verification page
    router.push(`/auth/verify-2fa?userId=${...}&email=${...}`)
    return
  }
````
</augment_code_snippet>

✅ **Correct**: Handles `requiresTwoFactor` response properly  
✅ **Correct**: Redirects to 2FA page with userId and email

### Findings

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| SL-1 | ✅ Pass | Session created before token generation | OK |
| SL-2 | ✅ Pass | `sessionId` included in JWT payload | OK |
| SL-3 | ✅ Pass | Proper cookie security flags (httpOnly, secure, sameSite) | OK |
| SL-4 | ✅ Pass | Both auth modes supported (cookie + request headers) | OK |

---

## 3. 2FA Login Flow Analysis

### Flow Steps

1. **User submits credentials** → `POST /user/auth/login`
2. **Backend validates credentials** → `AuthService.login()`
3. **Backend checks 2FA status** → `TwoFactorAuthService.getTwoFactorStatus()`
4. **If 2FA enabled:**
   - Sends verification code → `TwoFactorAuthService.createAndSendLoginCode()`
   - Creates `EmailVerification` record with `type: 'login_2fa'`
   - Returns `{ requiresTwoFactor: true, userId, email }` (NO tokens)
5. **Frontend redirects to 2FA page** → `/auth/verify-2fa?userId=...&email=...`
6. **User submits 6-digit code** → `POST /user/auth/two-factor/verify-code`
7. **Backend verifies code** → `TwoFactorAuthService.verifyLoginCode()`
8. **Backend creates session** → `SessionManagementService.createSession()`
9. **Backend generates tokens** → `AuthService.generateTokensFromUser(user, 'user', sessionId)`
10. **Frontend updates auth state and redirects**

### Code Review

#### Backend: 2FA Code Generation (Lines 101-160)

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/services/two-factor-auth.service.ts" mode="EXCERPT">
````typescript
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
      verified: false,
    },
  })

  // Generate new code
  const code = this.generateVerificationCode()
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES) // 15 minutes

  // Save to database with type 'login_2fa'
  await this.prisma.emailVerification.create({
    data: {
      userId,
      code,
      type: 'login_2fa', // Differentiate from signup verification
      expiresAt,
      ipAddress,
      userAgent,
    },
  })
````
</augment_code_snippet>

✅ **Correct**: Uses `type: 'login_2fa'` to differentiate from signup codes
✅ **Correct**: 15-minute expiry (`CODE_EXPIRY_MINUTES = 15`)
✅ **Correct**: Cleans up old unverified codes before creating new one

#### Backend: 2FA Code Verification (Lines 165-194)

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/services/two-factor-auth.service.ts" mode="EXCERPT">
````typescript
async verifyLoginCode(userId: string, code: string): Promise<boolean> {
  const verification = await this.prisma.emailVerification.findFirst({
    where: {
      userId,
      code,
      type: 'login_2fa', // Only check 2FA login codes
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
````
</augment_code_snippet>

✅ **Correct**: Filters by `type: 'login_2fa'`
✅ **Correct**: Checks expiry before accepting code
✅ **Correct**: Marks code as verified after successful validation

#### Backend: 2FA Login Completion (Lines 860-917)

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts" mode="EXCERPT">
````typescript
@Post('two-factor/verify-code')
async verifyLoginCode(
  @Body() body: { userId: string; code: string },
  @Res({ passthrough: true }) response: Response,
  @Req() request: Request
) {
  // Verify the 2FA code
  await this.twoFactorAuthService.verifyLoginCode(body.userId, body.code)

  // Fetch the full user with roles and permissions for token generation
  const user = await this.authService.validateUser(body.userId)

  if (!user) {
    throw new BadRequestException('User not found')
  }

  // Verify user has Parent role
  const hasParentRole = user.roles?.some((role: any) => role.name === 'Parent')

  if (!hasParentRole) {
    throw new UnauthorizedException('Access denied. Parent role required.')
  }

  // Create session record
  const userAgent = request.headers['user-agent']
  const ipAddress = request.ip

  const sessionId = await this.sessionManagementService.createSession(
    user.id,
    userAgent,
    ipAddress
  )

  // Generate app-specific tokens with 'user' claim and sessionId
  const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)

  // Set HTTP-only cookies for tokens with app-specific names
  response.cookie('wc_user_access_token', appTokens.accessToken, {
    httpOnly: true,
    secure: this.configService.getNodeEnv() === 'production',
    sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
    maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
  })
````
</augment_code_snippet>

✅ **Correct**: Verifies code before creating session
✅ **Correct**: Creates session before generating tokens
✅ **Correct**: Includes `sessionId` in JWT payload
✅ **Correct**: No tokens issued until 2FA verification completes

#### Frontend: 2FA Verification Page (Lines 52-106)

<augment_code_snippet path="world-schools/apps/wc-booking/src/app/auth/verify-2fa/page.tsx" mode="EXCERPT">
````typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!userId || !email) return

  setIsLoading(true)
  setError('')

  try {
    const response = await apiClient.post('/user/auth/two-factor/verify-code', {
      userId,
      code,
    })

    // Check if the response includes user data
    const hasUserData =
      response.success &&
      'data' in response &&
      response.data &&
      typeof response.data === 'object' &&
      'user' in response.data

    if (hasUserData) {
      // Manually update auth store state
      useAuthStore.setState({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      // Redirect to home page immediately
      router.replace('/')
    } else {
      setError('Verification failed. Please try again.')
    }
  } catch (err: any) {
    setError(err.response?.data?.message || 'Invalid or expired verification code')
    setCode('')
  } finally {
    setIsLoading(false)
  }
}
````
</augment_code_snippet>

✅ **Correct**: Calls correct endpoint `/user/auth/two-factor/verify-code`
✅ **Correct**: Updates auth store state manually after verification
✅ **Correct**: Redirects to home page after successful verification

### Findings

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| 2FA-1 | ✅ Pass | Uses `EmailVerification` table with `type: 'login_2fa'` | OK |
| 2FA-2 | ✅ Pass | 15-minute code expiry implemented | OK |
| 2FA-3 | ✅ Pass | No tokens issued until 2FA verification completes | OK |
| 2FA-4 | ✅ Pass | Session created before token generation in 2FA flow | OK |
| 2FA-5 | ✅ Pass | `sessionId` included in JWT payload for 2FA flow | OK |
| 2FA-6 | ⚠️ Warning | Resend endpoint path mismatch (see Issue #7) | Minor |

---

## 4. Cookie-Based Authentication Mode Analysis

**Configuration:** `NEXT_PUBLIC_AUTH_USING_REQUEST=false`

### Implementation Review

#### API Client Configuration

<augment_code_snippet path="world-schools/packages/wc-utils/src/lib/api-client.ts" mode="EXCERPT">
````typescript
// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: config.baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: !config.usingRequest, // Only include cookies if not using request headers
})
````
</augment_code_snippet>

✅ **Correct**: `withCredentials: true` when `usingRequest: false`
✅ **Correct**: Cookies automatically sent with every request

#### Backend Cookie Setting

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts" mode="EXCERPT">
````typescript
// Set HTTP-only cookies for tokens with app-specific names
response.cookie('wc_user_access_token', appTokens.accessToken, {
  httpOnly: true,
  secure: this.configService.getNodeEnv() === 'production',
  sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
  maxAge: parseDuration(this.configService.jwtConfig.expiresIn),
})

response.cookie('wc_user_refresh_token', appTokens.refreshToken, {
  httpOnly: true,
  secure: this.configService.getNodeEnv() === 'production',
  sameSite: this.configService.getNodeEnv() === 'production' ? 'none' : 'lax',
  maxAge: parseDuration(this.configService.jwtConfig.refreshExpiresIn),
})
````
</augment_code_snippet>

✅ **Correct**: HTTP-only cookies prevent XSS attacks
✅ **Correct**: Secure flag in production
✅ **Correct**: SameSite protection (none in prod, lax in dev)
✅ **Correct**: App-specific cookie names (`wc_user_*`)

### Findings

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| COOKIE-1 | ✅ Pass | `withCredentials: true` configured correctly | OK |
| COOKIE-2 | ✅ Pass | HTTP-only cookies prevent XSS | OK |
| COOKIE-3 | ✅ Pass | Secure flag enabled in production | OK |
| COOKIE-4 | ✅ Pass | SameSite protection configured | OK |
| COOKIE-5 | ✅ Pass | App-specific cookie names for isolation | OK |

---

## 5. Request-Based Authentication Mode Analysis

**Configuration:** `NEXT_PUBLIC_AUTH_USING_REQUEST=true`

### Implementation Review

#### API Client Token Handling

<augment_code_snippet path="world-schools/packages/wc-utils/src/lib/api-client.ts" mode="EXCERPT">
````typescript
// Request interceptor for auth
api.interceptors.request.use(
  axiosConfig => {
    if (config.usingRequest && accessToken) {
      // Add Authorization header when using request-based auth
      axiosConfig.headers.Authorization = `Bearer ${accessToken}`
    }
    // Cookies are automatically included with withCredentials: true when not using request headers
    return axiosConfig
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor for token refresh and token extraction
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Extract tokens from headers if authUsingRequest is enabled
    if (config.usingRequest) {
      const newAccessToken = response.headers['x-access-token']
      const newRefreshToken = response.headers['x-refresh-token']

      if (newAccessToken) {
        setTokens(newAccessToken, newRefreshToken || refreshToken)
      }
    }

    return response
  },
````
</augment_code_snippet>

✅ **Correct**: Adds `Authorization: Bearer <token>` header when `usingRequest: true`
✅ **Correct**: Extracts tokens from `x-access-token` and `x-refresh-token` headers
✅ **Correct**: Stores tokens in localStorage/sessionStorage

#### Backend Header Setting

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts" mode="EXCERPT">
````typescript
// If authUsingRequest is enabled, also send tokens in headers
if (this.configService.jwtConfig.authUsingRequest) {
  response.setHeader('x-access-token', appTokens.accessToken)
  response.setHeader('x-refresh-token', appTokens.refreshToken)
}
````
</augment_code_snippet>

✅ **Correct**: Sets tokens in response headers when `authUsingRequest: true`
✅ **Correct**: Still sets cookies for backward compatibility

#### Middleware: Request Header to Cookie Conversion

<augment_code_snippet path="world-schools/apps/wc-nest-api/src/common/middleware/auth-token.middleware.ts" mode="EXCERPT">
````typescript
use(req: Request, res: Response, next: NextFunction) {
  const authUsingRequest = this.configService.jwtConfig.authUsingRequest
  if (authUsingRequest) {
    // Convert request headers to app-specific cookies for JWT strategy
    const isUser = req.path.startsWith('/user')

    if (req.headers['x-access-token']) {
      if (!req.cookies) req.cookies = {}
      if (isUser) {
        req.cookies['wc_user_access_token'] = req.headers['x-access-token'] as string
      }
    }
    if (req.headers['x-refresh-token']) {
      if (!req.cookies) req.cookies = {}
      if (isUser) {
        req.cookies['wc_user_refresh_token'] = req.headers['x-refresh-token'] as string
      }
    }
  }
  next()
}
````
</augment_code_snippet>

✅ **Correct**: Converts `x-access-token` header to `wc_user_access_token` cookie internally
✅ **Correct**: Allows JWT strategy to work with both auth modes

### Findings

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| REQ-1 | ✅ Pass | Authorization header set correctly | OK |
| REQ-2 | ✅ Pass | Tokens extracted from response headers | OK |
| REQ-3 | ✅ Pass | Tokens stored in localStorage/sessionStorage | OK |
| REQ-4 | ✅ Pass | Middleware converts headers to cookies internally | OK |
| REQ-5 | ✅ Pass | Both modes work with same JWT strategy | OK |

---

## 6. Issues Found

### Critical Issues

#### Issue #1: Missing `sessionId` in Email Verification Flow

**Severity:** 🔴 **CRITICAL**

**Location:** `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Lines 185-186)

**Current Behavior:**
```typescript
// Generate app-specific tokens with 'user' claim for token isolation
const appTokens = this.authService.generateTokensFromUser(user, 'user')
```

**Expected Behavior:**
```typescript
// Create session record FIRST
const sessionId = await this.sessionManagementService.createSession(
  user.id,
  request.headers['user-agent'],
  request.ip
)

// Generate tokens WITH sessionId
const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)
```

**Impact:**
- Tokens generated during email verification do NOT have `sessionId` in payload
- Session tracking is broken for users who verify email
- Cannot revoke sessions for these users
- Security risk: no way to track or invalidate these sessions

**Affected Endpoints:**
- `POST /user/auth/verify-email` (Lines 149-213)

---

#### Issue #2: Missing `sessionId` in Google Sign-In Flow

**Severity:** 🔴 **CRITICAL**

**Location:** `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Lines 470-471)

**Current Behavior:**
```typescript
// Generate app-specific tokens with 'user' claim for token isolation
const appTokens = this.authService.generateTokensFromUser(fullUser, 'user')
```

**Expected Behavior:**
```typescript
// Create session record FIRST
const sessionId = await this.sessionManagementService.createSession(
  fullUser.id,
  request.headers['user-agent'],
  request.ip
)

// Generate tokens WITH sessionId
const appTokens = this.authService.generateTokensFromUser(fullUser, 'user', sessionId)
```

**Impact:**
- Google OAuth users have no session tracking
- Cannot view or revoke sessions for OAuth users
- Security risk: no session management for OAuth logins

**Affected Endpoints:**
- `POST /user/auth/google-signin` (Lines 339-500)

---

#### Issue #3: Missing `sessionId` in Token Refresh Flow

**Severity:** 🔴 **CRITICAL**

**Location:** `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Lines 532-533)

**Current Behavior:**
```typescript
// Generate app-specific tokens with 'user' claim for token isolation
const appTokens = this.authService.generateTokensFromUser(user, 'user')
```

**Expected Behavior:**
```typescript
// Extract sessionId from current refresh token payload
const decoded = this.jwtService.verify(refreshToken, {
  secret: this.configService.jwtConfig.refreshSecret,
})
const sessionId = decoded.sessionId

// Generate new tokens with SAME sessionId
const appTokens = this.authService.generateTokensFromUser(user, 'user', sessionId)
```

**Impact:**
- Token refresh loses `sessionId` from payload
- After first refresh, session tracking is broken
- Users cannot see their active sessions after token refresh
- Critical security flaw: session management breaks after 15 minutes

**Affected Endpoints:**
- `POST /user/auth/refresh` (Lines 502-557)

---

### High Severity Issues

#### Issue #4: Inconsistent Session Creation Across Flows

**Severity:** 🟠 **HIGH**

**Summary:**
- ✅ Simple login: Creates session
- ✅ 2FA login: Creates session
- ❌ Email verification: NO session creation
- ❌ Google sign-in: NO session creation
- ❌ Token refresh: NO session handling

**Impact:**
- Inconsistent user experience
- Some users have session tracking, others don't
- Session management features only work for some authentication flows

---

### Medium Severity Issues

#### Issue #5: 2FA Resend Endpoint Path Mismatch

**Severity:** 🟡 **MEDIUM**

**Location:** `world-schools/apps/wc-booking/src/app/auth/verify-2fa/page.tsx` (Line 115)

**Current Code:**
```typescript
await apiClient.post('/user/auth/two-factor/send-login-code', {
  userId,
  email,
})
```

**Actual Backend Endpoint:**
```typescript
@Post('two-factor/send-code')  // NOT 'send-login-code'
async sendLoginCode(@Body() body: { userId: string; email: string }, @Req() request: Request)
```

**Impact:**
- Resend code functionality may not work
- 404 error when trying to resend 2FA code
- Poor user experience if code expires

**Note:** This appears to be a documentation/naming inconsistency. Need to verify actual endpoint path.

---

### Low Severity Issues

#### Issue #6: Missing Request Object in Email Verification

**Severity:** 🟢 **LOW**

**Location:** `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Line 157)

**Current Signature:**
```typescript
async verifyEmail(
  @Body() verifyEmailDto: UserVerifyEmailDto,
  @Res({ passthrough: true }) response: Response
)
```

**Recommended Signature:**
```typescript
async verifyEmail(
  @Body() verifyEmailDto: UserVerifyEmailDto,
  @Res({ passthrough: true }) response: Response,
  @Req() request: Request  // Add this
)
```

**Impact:**
- Cannot capture IP address and user agent for session creation
- Less detailed session tracking
- Minor security/audit trail gap

---

## 7. Actionable Tasks

### Priority 1: Critical Fixes (Must Fix Immediately)

1. **Fix Email Verification Session Creation**
   - File: `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts`
   - Lines: 157-213
   - Action:
     - Add `@Req() request: Request` parameter
     - Create session before generating tokens
     - Pass `sessionId` to `generateTokensFromUser()`

2. **Fix Google Sign-In Session Creation**
   - File: `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts`
   - Lines: 347-500
   - Action:
     - Add `@Req() request: Request` parameter (if not present)
     - Create session before generating tokens
     - Pass `sessionId` to `generateTokensFromUser()`

3. **Fix Token Refresh Session Preservation**
   - File: `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts`
   - Lines: 509-557
   - Action:
     - Decode refresh token to extract `sessionId`
     - Pass existing `sessionId` to `generateTokensFromUser()`
     - Do NOT create new session on refresh

### Priority 2: High Priority Fixes

4. **Verify and Fix 2FA Resend Endpoint**
   - Files:
     - Frontend: `world-schools/apps/wc-booking/src/app/auth/verify-2fa/page.tsx` (Line 115)
     - Backend: `world-schools/apps/wc-nest-api/src/modules/user/auth/auth.controller.ts` (Line 830)
   - Action:
     - Verify actual endpoint path
     - Update frontend to use correct path: `/user/auth/two-factor/send-code`
     - OR update backend to match frontend expectation

### Priority 3: Testing and Validation

5. **Test All Authentication Flows**
   - Test simple login with session tracking
   - Test 2FA login with session tracking
   - Test email verification with session tracking (after fix)
   - Test Google sign-in with session tracking (after fix)
   - Test token refresh preserves sessionId (after fix)

6. **Test Both Authentication Modes**
   - Test cookie-based auth (`NEXT_PUBLIC_AUTH_USING_REQUEST=false`)
   - Test request-based auth (`NEXT_PUBLIC_AUTH_USING_REQUEST=true`)
   - Verify tokens are set correctly in both modes
   - Verify session management works in both modes

---

## 8. Recommendations

### Security Best Practices

1. **Consistent Session Management**
   - ALL authentication flows should create sessions
   - ALL token generation should include `sessionId`
   - Token refresh should preserve `sessionId`

2. **Session Tracking**
   - Implement session activity tracking (update `lastActiveAt` on each request)
   - Add session expiry cleanup job
   - Allow users to view and revoke active sessions

3. **Audit Logging**
   - Log all authentication attempts (success and failure)
   - Log session creation and revocation
   - Log 2FA code generation and verification

### Code Quality Improvements

1. **Centralize Session Creation Logic**
   - Create a helper method that combines session creation + token generation
   - Ensures consistency across all auth flows
   - Example:
     ```typescript
     async createAuthenticatedSession(
       user: User,
       request: Request,
       response: Response,
       app: 'user' | 'provider' | 'superadmin'
     ) {
       const sessionId = await this.sessionManagementService.createSession(
         user.id,
         request.headers['user-agent'],
         request.ip
       )

       const tokens = this.authService.generateTokensFromUser(user, app, sessionId)

       this.setCookies(response, tokens, app)

       return { user, tokens, sessionId }
     }
     ```

2. **Add Integration Tests**
   - Test complete login flows end-to-end
   - Test session creation and tracking
   - Test token refresh preserves sessionId
   - Test 2FA flows

3. **Improve Error Handling**
   - Return consistent error responses
   - Add specific error codes for different failure scenarios
   - Improve error messages for better debugging

### Documentation

1. **Update API Documentation**
   - Document all authentication endpoints
   - Document expected request/response formats
   - Document session management behavior

2. **Create Authentication Flow Diagrams**
   - Visual diagrams for simple login
   - Visual diagrams for 2FA login
   - Visual diagrams for OAuth login

3. **Document Configuration**
   - Document `NEXT_PUBLIC_AUTH_USING_REQUEST` behavior
   - Document cookie vs request-based auth differences
   - Document session management configuration

---

## 9. Summary

### What's Working Well ✅

- 2FA implementation using `EmailVerification` table with `type: 'login_2fa'`
- 15-minute code expiry for 2FA codes
- Proper separation of simple login and 2FA flows
- No tokens issued until 2FA verification completes
- App-specific cookie names for token isolation
- Support for both cookie-based and request-based authentication
- HTTP-only cookies with proper security flags
- Automatic token refresh on 401 errors

### Critical Gaps ❌

- Missing `sessionId` in email verification flow
- Missing `sessionId` in Google sign-in flow
- Missing `sessionId` preservation in token refresh flow
- Inconsistent session creation across authentication flows

### Next Steps

1. **Immediate:** Fix the 3 critical session management issues
2. **Short-term:** Verify and fix 2FA resend endpoint path
3. **Medium-term:** Add comprehensive integration tests
4. **Long-term:** Implement centralized session creation helper and improve documentation

---

**End of Audit**


