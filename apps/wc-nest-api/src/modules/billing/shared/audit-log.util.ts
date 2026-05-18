import type { Logger } from '@nestjs/common'

/**
 * Emits a single-line structured audit event for billing operations.
 *
 * Format mirrors `stripe-connect.service.ts` `auditLog`: `<scope>.audit
 * key1="value1" key2="value2"`. The keyword=value layout is grep-friendly in
 * Loki/Datadog without needing a separate audit table.
 *
 * Avoid PII: log identifiers and outcomes only — never email, name, or PAN.
 */
export function billingAudit(
  logger: Logger,
  scope: string,
  fields: Record<string, string | number | boolean | null | undefined>
): void {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${snake(k)}=${JSON.stringify(v)}`)
  logger.log(`billing.${scope}.audit ${parts.join(' ')}`)
}

function snake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}
