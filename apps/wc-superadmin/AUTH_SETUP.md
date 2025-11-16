# WC Superadmin Authentication Setup

This document describes the authentication infrastructure for the World Camps Superadmin application.

## Overview

The wc-superadmin application uses a complete JWT-based authentication system that integrates with the `wc-nest-api` backend (superadmin module). The authentication system supports both cookie-based and request-based authentication modes.

## Architecture

### Frontend Components

1. **Config** (`src/config/config.ts`)
   - Centralized configuration for API URL and auth mode
   - Uses Next.js environment variables (`NEXT_PUBLIC_*`)

2. **API Client** (`src/utils/api-client.ts`)
   - Axios-based HTTP client with automatic token management
   - Request/response interceptors for auth headers and token refresh
   - Supports both cookie-based and request-based authentication
   - Automatic token refresh on 401 errors with request queuing

3. **Auth Service** (`src/services/auth.services.ts`)
   - Service layer for all authentication-related API calls
   - Provides clean separation between API layer and state management
   - Exports service methods: `loginApi`, `logoutApi`, `refreshTokenApi`, `getProfileApi`, `changePasswordApi`
   - Follows the service layer pattern from sales-pipeline-dashboard

4. **Auth Store** (`src/stores/auth-store.ts`)
   - Zustand store with immer middleware for state management
   - Manages user state, authentication status, and auth actions
   - Uses auth service methods for all API operations
   - Persists user data in sessionStorage

5. **Auth Types** (`src/types/auth.ts`)
   - Re-exports shared types from `@world-schools/wc-types` package
   - Local extensions for wc-superadmin specific needs

6. **Auth Hook** (`src/hooks/use-auth.ts`)
   - Convenient hook for accessing auth state and actions
   - Provides `isSuperAdmin` computed property

7. **Auth Provider** (`src/components/auth/auth-provider.tsx`)
   - Initializes authentication state on app load
   - Shows loading state while initializing
   - Wraps the entire application

8. **Protected Route** (`src/components/auth/protected-route.tsx`)
   - Guards routes that require authentication
   - Supports both general auth and superadmin-specific protection
   - Handles redirects to signin or not-authorized pages

### Backend Endpoints

All endpoints are prefixed with `/superadmin/auth/`:

- `POST /login` - Login with email and password
- `POST /refresh` - Refresh access token using refresh token
- `GET /profile` - Get current user profile
- `PATCH /change-password` - Change user password
- `POST /logout` - Logout and clear server-side session

## Authentication Modes

### Cookie-Based Authentication (Default, Recommended)

- **How it works**: Tokens are stored in HTTP-only cookies
- **Security**: More secure as tokens are not accessible to JavaScript
- **Configuration**: `NEXT_PUBLIC_AUTH_USING_REQUEST=false`
- **Best for**: Production environments

### Request-Based Authentication

- **How it works**: Tokens are stored in localStorage/sessionStorage and sent via Authorization header
- **Security**: Less secure as tokens are accessible to JavaScript
- **Configuration**: `NEXT_PUBLIC_AUTH_USING_REQUEST=true`
- **Best for**: Development or specific deployment scenarios

## Token Management

### Token Types

1. **Access Token**
   - Expiry: 15 minutes
   - Contains: User ID, email, roles, permissions
   - Used for: API authentication

2. **Refresh Token**
   - Expiry: 7 days
   - Contains: User ID only
   - Used for: Obtaining new access tokens

### Storage Strategy

The API client uses a graceful fallback strategy for token storage:

1. **localStorage** (preferred)
2. **sessionStorage** (fallback)
3. **Memory** (last resort)

### Automatic Token Refresh

- Triggered on 401 Unauthorized responses
- Prevents multiple simultaneous refresh attempts
- Queues failed requests and retries after refresh
- Logs out user if refresh fails

## Usage Examples

### Using the Auth Hook

```typescript
import { useAuth } from '@/hooks/use-auth'

function MyComponent() {
  const { user, isAuthenticated, isSuperAdmin, login, logout } = useAuth()

  const handleLogin = async () => {
    const success = await login({ email: 'admin@example.com', password: 'password' })
    if (success) {
      // Handle successful login
    }
  }

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.email}</p>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  )
}
```

### Protecting Routes

```typescript
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function DashboardPage() {
  return (
    <ProtectedRoute requireAuth requireSuperAdmin>
      <div>Protected Dashboard Content</div>
    </ProtectedRoute>
  )
}
```

### Making API Calls

```typescript
import * as apiClient from '@/utils/api-client'

// GET request
const response = await apiClient.get('/some-endpoint')

// POST request
const response = await apiClient.post('/some-endpoint', { data: 'value' })

// All requests automatically include auth headers/cookies
```

## Environment Variables

Create a `.env.local` file based on `.env.example`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/

# Authentication Mode
NEXT_PUBLIC_AUTH_USING_REQUEST=false
```

## Shared Packages

The authentication system leverages shared monorepo packages:

- **@world-schools/wc-types**: Shared TypeScript types for authentication
- **@world-schools/wc-utils**: Shared utility functions (e.g., `parseDuration`)

## Security Best Practices

1. **Use cookie-based auth in production** for better security
2. **HTTPS only** in production (secure flag on cookies)
3. **SameSite protection** enabled on cookies
4. **HTTP-only cookies** prevent XSS attacks
5. **Short-lived access tokens** (15 minutes)
6. **Longer refresh tokens** (7 days) for better UX
7. **Automatic token refresh** prevents session interruption

## Testing

To test the authentication system:

1. Start the backend: `nx serve wc-nest-api`
2. Start the frontend: `nx serve wc-superadmin`
3. Navigate to `http://localhost:4301/auth/signin`
4. Login with valid superadmin credentials
5. Verify token storage in browser DevTools
6. Test protected routes and automatic token refresh

## Troubleshooting

### Login fails with CORS error
- Check `CORS_ORIGINS` in backend `.env` includes frontend URL
- Verify `withCredentials: true` in API client for cookie-based auth

### Tokens not persisting
- Check browser storage (localStorage/sessionStorage)
- Verify cookies in DevTools (Application > Cookies)
- Check for storage quota errors in console

### Automatic refresh not working
- Verify refresh token is valid and not expired
- Check network tab for refresh endpoint calls
- Ensure backend refresh endpoint is working

## Future Enhancements

- [ ] Add "Remember Me" functionality
- [ ] Implement password reset flow
- [ ] Add multi-factor authentication (MFA)
- [ ] Add session management (view/revoke active sessions)
- [ ] Add OAuth providers (Google, Microsoft, etc.)

