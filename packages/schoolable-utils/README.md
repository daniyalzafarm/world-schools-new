# schoolable-utils

Shared utility functions and API client for Schoolable applications.

## Features

- **API Client**: Configurable HTTP client with automatic token management and refresh
- **Type-safe**: Full TypeScript support with exported types
- **Authentication**: Built-in support for JWT token handling (cookie-based and request-based)
- **File Uploads**: Support for file and FormData uploads

## Usage

### API Client

```typescript
import { createApiClient } from '@world-schools/schoolable-utils'

const apiClient = createApiClient({
  baseURL: 'http://localhost:3000/',
  usingRequest: false,
  storageKeyPrefix: 'schoolable',
  refreshEndpoint: '/auth/refresh'
})

// Use the client
const response = await apiClient.get('/users')
await apiClient.post('/auth/login', { email, password })
```

## Building

Run `nx build schoolable-utils` to build the library.

## Running unit tests

Run `nx test schoolable-utils` to execute the unit tests via Vitest.

