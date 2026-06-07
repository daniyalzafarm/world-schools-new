import type { BaseRuntimeConfig } from './types'

const CONFIG_URL = '/config.json'

let cachedClientConfig: BaseRuntimeConfig | undefined
let inflightFetch: Promise<BaseRuntimeConfig> | undefined

declare global {
  interface Window {
    __APP_CONFIG__?: BaseRuntimeConfig
  }
}

/**
 * Synchronously read runtime config on the client.
 *
 * The root layout injects an inline <script> that sets window.__APP_CONFIG__
 * before any client JS runs, so this is safe to call from any component or
 * hook. Throws if neither the inline script nor ensureClientConfig() has run.
 */
export function getClientConfigSync<T extends BaseRuntimeConfig = BaseRuntimeConfig>(): T {
  if (typeof window === 'undefined') {
    throw new Error('getClientConfigSync called on the server')
  }
  if (window.__APP_CONFIG__) return window.__APP_CONFIG__ as T
  if (cachedClientConfig) return cachedClientConfig as T
  throw new Error(
    'Runtime config not initialized. The inline <script> did not render, or this ran ' +
      'before ensureClientConfig() resolved. Check the root layout.'
  )
}

/**
 * Asynchronously load runtime config from /config.json on the client.
 *
 * Useful for tooling, test harnesses, or future no-SSR consumers that load
 * outside the App Router. Idempotent and request-deduplicated.
 */
export async function ensureClientConfig<
  T extends BaseRuntimeConfig = BaseRuntimeConfig,
>(): Promise<T> {
  if (typeof window !== 'undefined' && window.__APP_CONFIG__) {
    return window.__APP_CONFIG__ as T
  }
  if (cachedClientConfig) return cachedClientConfig as T
  if (!inflightFetch) {
    inflightFetch = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${CONFIG_URL}: ${response.status}`)
        }
        return response.json() as Promise<BaseRuntimeConfig>
      })
      .then(config => {
        cachedClientConfig = config
        if (typeof window !== 'undefined') {
          window.__APP_CONFIG__ = config
        }
        return config
      })
  }
  return (await inflightFetch) as T
}
