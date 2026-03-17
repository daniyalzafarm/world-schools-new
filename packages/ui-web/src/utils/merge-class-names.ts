import type { ClassValue } from 'clsx'
import { cn } from './cn'

type ClassNamesRecord = Record<string, ClassValue | undefined>

/**
 * Merges HeroUI-style `classNames` objects by slot key.
 * For each key, it concatenates default classes with override classes.
 */
export function mergeClassNames<
  TDefaults extends ClassNamesRecord,
  TOverrides extends ClassNamesRecord,
>(defaults: TDefaults, overrides?: TOverrides): TDefaults & TOverrides {
  const keys = new Set<string>([...Object.keys(defaults ?? {}), ...Object.keys(overrides ?? {})])

  const merged: Record<string, ClassValue | undefined> = {}
  for (const key of keys) {
    merged[key] = cn((defaults as any)[key], (overrides as any)?.[key])
  }

  return { ...(overrides ?? {}), ...(merged as any) }
}
