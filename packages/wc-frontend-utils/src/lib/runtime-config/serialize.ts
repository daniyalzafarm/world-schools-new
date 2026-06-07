import serialize from 'serialize-javascript'

import type { BaseRuntimeConfig } from './types'

/**
 * Serialize runtime config for safe inline-script injection.
 *
 * Escapes </script>, <, >, &, U+2028 and U+2029 so config values cannot
 * break out of the surrounding <script> tag — XSS-safe even if a value
 * contains user-controlled HTML.
 */
export function serializeConfigForScript<T extends BaseRuntimeConfig>(config: T): string {
  return serialize(config, { isJSON: true })
}
