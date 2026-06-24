import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  getAllPermissions,
  getContextPermissionIds,
  providerContext,
  superadminContext,
} from './permissions'

/**
 * Catalog-integrity guard.
 *
 * Keeps the permission catalog (permissions.ts) in lock-step with the `@Permissions(...)`
 * decorators that actually enforce access on controllers. It prevents:
 *   - a decorator referencing a permission that isn't defined (the route becomes unreachable
 *     via permissions and the action shows up in no role form),
 *   - a permission defined in the catalog that no endpoint enforces (a dead checkbox), and
 *   - a permission listed in a CONTEXT's role form (superadmin/provider) that no endpoint of that
 *     app actually enforces (a checkbox that does nothing for that app's roles).
 */
const SRC_ROOT = join(__dirname, '..')

function listControllerFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listControllerFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      out.push(full)
    }
  }
  return out
}

function permissionsInDecorators(content: string): string[] {
  const found: string[] = []
  const decoratorRe = /@Permissions\(([^)]*)\)/g
  const stringRe = /'([^']+)'/g
  let decorator: RegExpExecArray | null
  while ((decorator = decoratorRe.exec(content)) !== null) {
    let str: RegExpExecArray | null
    while ((str = stringRe.exec(decorator[1])) !== null) {
      found.push(str[1])
    }
  }
  return found
}

function collectUsedPermissions(): Set<string> {
  const used = new Set<string>()
  for (const file of listControllerFiles(SRC_ROOT)) {
    for (const p of permissionsInDecorators(readFileSync(file, 'utf8'))) used.add(p)
  }
  return used
}

/**
 * Bucket each controller's `@Permissions` by its `@Controller('<prefix>/…')` route prefix, so we
 * can tell which permissions a given app (superadmin vs provider) actually enforces. Files without
 * a superadmin/provider-prefixed `@Controller` (shared/abstract/public) are ignored.
 */
function collectUsedByContext(): { superadmin: Set<string>; provider: Set<string> } {
  const superadmin = new Set<string>()
  const provider = new Set<string>()
  const controllerRe = /@Controller\(\s*['"`]([^'"`]*)['"`]/
  for (const file of listControllerFiles(SRC_ROOT)) {
    const content = readFileSync(file, 'utf8')
    const path = controllerRe.exec(content)?.[1] ?? ''
    const bucket = path.startsWith('superadmin')
      ? superadmin
      : path.startsWith('provider')
        ? provider
        : null
    if (!bucket) continue
    for (const p of permissionsInDecorators(content)) bucket.add(p)
  }
  return { superadmin, provider }
}

describe('permission catalog integrity', () => {
  const defined = new Set(getAllPermissions().map(p => p.id))
  const used = collectUsedPermissions()
  const byContext = collectUsedByContext()

  it('discovers permission decorators to validate against', () => {
    expect(used.size).toBeGreaterThan(0)
  })

  it('every @Permissions(...) string is defined in the catalog', () => {
    const undefinedPermissions = [...used].filter(p => !defined.has(p)).sort()
    expect(undefinedPermissions).toEqual([])
  })

  it('every catalog permission is enforced by at least one endpoint', () => {
    const orphanPermissions = [...defined].filter(p => !used.has(p)).sort()
    expect(orphanPermissions).toEqual([])
  })

  it('every superadminContext permission is enforced by a /superadmin endpoint', () => {
    const unenforced = getContextPermissionIds(superadminContext)
      .filter(p => !byContext.superadmin.has(p))
      .sort()
    expect(unenforced).toEqual([])
  })

  it('every providerContext permission is enforced by a /provider endpoint', () => {
    const unenforced = getContextPermissionIds(providerContext)
      .filter(p => !byContext.provider.has(p))
      .sort()
    expect(unenforced).toEqual([])
  })
})
