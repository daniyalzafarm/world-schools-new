/**
 * Runtime configuration shared by all wc-* Next.js apps.
 *
 * Values are read from process.env at request time on the server and from
 * window.__APP_CONFIG__ (injected by the root layout's inline script) on the
 * client. The same Docker image therefore runs in any environment — env vars
 * are never baked in at build time.
 */

export interface BaseRuntimeConfig {
  apiBaseUrl: string
  appUrl: string
  appVersion: string
  wsUrl?: string
  authUsingRequest: boolean
  googleMapsApiKey?: string
  /** Public Google OAuth client ID for "Sign in with Google" (booking app only). */
  googleOAuthClientId?: string
  stripePublishableKey?: string
  enableWebsocketMessages: boolean
  websocketFallbackHttp: boolean
}
