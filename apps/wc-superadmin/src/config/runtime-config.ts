import {
  type BaseRuntimeConfig,
  ensureClientConfig as ensureClientConfigBase,
  getClientConfigSync,
  readBaseServerConfig,
  serializeConfigForScript as serializeConfigForScriptBase,
} from '@world-schools/wc-frontend-utils/runtime-config'

export interface SuperadminRuntimeConfig extends BaseRuntimeConfig {
  providerAppUrl?: string
  bookingAppUrl?: string
}

export function getServerConfig(): SuperadminRuntimeConfig {
  return {
    ...readBaseServerConfig(),
    providerAppUrl: process.env.PROVIDER_APP_URL,
    bookingAppUrl: process.env.BOOKING_APP_URL,
  }
}

export function getRuntimeConfig(): SuperadminRuntimeConfig {
  return typeof window === 'undefined'
    ? getServerConfig()
    : getClientConfigSync<SuperadminRuntimeConfig>()
}

export const ensureClientConfig = () => ensureClientConfigBase<SuperadminRuntimeConfig>()
export const serializeConfigForScript = (config: SuperadminRuntimeConfig) =>
  serializeConfigForScriptBase(config)
