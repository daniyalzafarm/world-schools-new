import {
  type BaseRuntimeConfig,
  ensureClientConfig as ensureClientConfigBase,
  getClientConfigSync,
  readBaseServerConfig,
  serializeConfigForScript as serializeConfigForScriptBase,
} from '@world-schools/wc-frontend-utils/runtime-config'

export interface ProviderRuntimeConfig extends BaseRuntimeConfig {
  bookingAppUrl?: string
  superadminAppUrl?: string
}

export function getServerConfig(): ProviderRuntimeConfig {
  return {
    ...readBaseServerConfig(),
    bookingAppUrl: process.env.BOOKING_APP_URL,
    superadminAppUrl: process.env.SUPERADMIN_APP_URL,
  }
}

export function getRuntimeConfig(): ProviderRuntimeConfig {
  return typeof window === 'undefined'
    ? getServerConfig()
    : getClientConfigSync<ProviderRuntimeConfig>()
}

export const ensureClientConfig = () => ensureClientConfigBase<ProviderRuntimeConfig>()
export const serializeConfigForScript = (config: ProviderRuntimeConfig) =>
  serializeConfigForScriptBase(config)
