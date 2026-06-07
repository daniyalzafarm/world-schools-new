import {
  type BaseRuntimeConfig,
  ensureClientConfig as ensureClientConfigBase,
  getClientConfigSync,
  readBaseServerConfig,
  serializeConfigForScript as serializeConfigForScriptBase,
} from '@world-schools/wc-frontend-utils/runtime-config'

export type BookingRuntimeConfig = BaseRuntimeConfig

export function getServerConfig(): BookingRuntimeConfig {
  return readBaseServerConfig()
}

export function getRuntimeConfig(): BookingRuntimeConfig {
  return typeof window === 'undefined'
    ? getServerConfig()
    : getClientConfigSync<BookingRuntimeConfig>()
}

export const ensureClientConfig = () => ensureClientConfigBase<BookingRuntimeConfig>()
export const serializeConfigForScript = (config: BookingRuntimeConfig) =>
  serializeConfigForScriptBase(config)
