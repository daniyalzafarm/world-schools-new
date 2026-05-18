// Utilities (backend-compatible)
export * from './lib/parse-duration'
export * from './lib/currency'
export * from './lib/cancellation-policy'
export * from './lib/payment-plan'

// KB HTML allowlists (shared between backend and frontend)
export * from './lib/kb-allowed-html'

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
