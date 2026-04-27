/**
 * Thin browser-side logger wrapper. Centralizing this so handlers don't sprinkle
 * `console.error(...)` calls — and so we can route logs through a structured
 * sink (Datadog, Sentry, etc.) later without touching every call site.
 *
 * Today it forwards to `console` and tags every entry with the supplied scope.
 * In production builds it could be wired to a remote target — keep the API
 * narrow so that's a one-line change.
 */
export function createLogger(scope: string) {
  const prefix = `[${scope}]`
  return {
    info(message: string, meta?: unknown) {
      // eslint-disable-next-line no-console
      console.info(prefix, message, meta ?? '')
    },
    warn(message: string, meta?: unknown) {
      console.warn(prefix, message, meta ?? '')
    },
    error(message: string, meta?: unknown) {
      console.error(prefix, message, meta ?? '')
    },
  }
}
