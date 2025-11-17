# wc-frontend-utils

Frontend-specific utilities for World Camps (WC) applications in the World Schools monorepo.

## Overview

This package contains React components and frontend-specific utilities used across World Camps applications including:
- Authentication components (AuthProvider, ProtectedRoute)
- Auth state management (Zustand store factory)
- Theme configuration (HeroUI theme)
- Frontend-only utilities

**Note**: This package contains JSX/React code and is intended for frontend applications only. For backend-compatible utilities, use `@world-schools/wc-utils`.

## Usage

```typescript
import { createAuthStore, AuthProvider, ProtectedRoute, wcThemeConfig } from '@world-schools/wc-frontend-utils'

// Create auth store
const { useAuthStore } = createAuthStore({ ... })

// Use components
<AuthProvider useAuthStore={useAuthStore}>
  <ProtectedRoute requireAuth>
    <YourApp />
  </ProtectedRoute>
</AuthProvider>
```

## Available Exports

### Components
- `AuthProvider` - Authentication initialization component
- `ProtectedRoute` - Route protection with role-based access control

### Factories
- `createAuthStore` - Zustand store factory for auth state management

### Theme
- `wcThemeConfig` - HeroUI theme configuration for World Camps apps

## Development

This library was generated with [Nx](https://nx.dev).

### Running unit tests

Run `nx test wc-frontend-utils` to execute the unit tests via [Vitest](https://vitest.dev/).

