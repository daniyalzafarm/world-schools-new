/**
 * Backend-only exports
 * 
 * This file exports services that should only be used in backend/server environments.
 * Do NOT import this file in frontend applications.
 */

// Azure Storage Service (NestJS service - backend only)
export * from './services/azure-storage.service'
export * from './services/azure-storage.types'

