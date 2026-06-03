import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderEmail } from '../lib/renderer'

/**
 * Phase 2 plan item, deferred to Phase 8 — payment-domain templates only
 * become numerous enough at this point for the lint to be meaningful.
 *
 * From `WorldCamps_Notifications_v28.xlsx → Notes & Conventions`: certain
 * payment terminology is forbidden because it mischaracterises how the
 * platform handles funds under Direct Charges (funds live on the connected
 * account, NOT in a platform escrow). If a template ever ships with one
 * of these phrases, CI fails.
 */
const FORBIDDEN_PHRASES = [
  'destination charges',
  'we hold your money',
  'funds held by world camps',
  'platform escrow',
] as const

const TEMPLATES_ROOT = path.resolve(__dirname, '../../emails')

async function findTemplates(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue // _shared
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await findTemplates(full)))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

describe('Forbidden payment phrases', () => {
  it('no template renders a forbidden payment phrase', async () => {
    const templatePaths = await findTemplates(TEMPLATES_ROOT)
    expect(templatePaths.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const tplPath of templatePaths) {
      const mod = (await import(tplPath)) as {
        default?: (props: unknown) => unknown
        PreviewProps?: unknown
      }
      if (!mod.default || !mod.PreviewProps) continue
      const { html, text } = await renderEmail(
        mod.default as Parameters<typeof renderEmail>[0],
        mod.PreviewProps,
        { includePlainText: true }
      )
      const haystack = `${html.toLowerCase()}\n${text.toLowerCase()}`
      for (const phrase of FORBIDDEN_PHRASES) {
        if (haystack.includes(phrase)) {
          violations.push(`${path.relative(TEMPLATES_ROOT, tplPath)}: "${phrase}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
