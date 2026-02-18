// Utilities (backend-compatible)
export * from './lib/parse-duration'

// API client
export * from './lib/api-client'
export * from './lib/api-client.types'

// Event bus
export * from './lib/event-bus'

// Auth service (backend-compatible)
export * from './lib/create-auth-service'

// Azure Storage Service (backend-only - do not import in frontend)
// Export types only for frontend use
export * from './services/azure-storage.types'
