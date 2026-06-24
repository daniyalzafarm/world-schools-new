/**
 * Navigation Utilities
 *
 * Single source of truth for "dashboard section -> required permission". This config is consumed
 * by BOTH the sidebar (to decide which items are visible) and the RouteGuard (to decide which
 * routes a user may access), so the two can never drift.
 *
 * Matching is longest-prefix based, so `/providers` also covers `/providers/[id]`,
 * `/providers/approved`, etc. Create/edit pages that need a stricter permission than the
 * section's read permission additionally self-guard at the page level.
 *
 * RouteGuard is DENY-BY-DEFAULT for dashboard routes: a route must either declare a `permission`
 * or be explicitly marked `public`. A new dashboard route with no entry here is treated as
 * inaccessible (fail closed) rather than silently exposed.
 */

interface RouteConfig {
  path: string
  /** Required permission(s) to access this route (and its children). An array means ANY-of (OR). */
  permission?: string | string[]
  /** Accessible to any authenticated user, no permission required. */
  public?: boolean
  label: string
}

/** Whether a user satisfies a route's permission requirement (public / none / any-of). */
function isPermitted(route: RouteConfig, userPermissions: string[]): boolean {
  if (route.public || !route.permission) return true
  const required = Array.isArray(route.permission) ? route.permission : [route.permission]
  return required.some(p => userPermissions.includes(p))
}

/**
 * All dashboard routes in priority order (first accessible one is the post-login landing).
 */
export const ROUTES: RouteConfig[] = [
  { path: '/analytics-dashboard', label: 'Analytics Dashboard', permission: 'analytics.read' },
  { path: '/financial-dashboard', label: 'Financial Dashboard', permission: 'financial.read' },
  { path: '/reimbursements', label: 'Reimbursements', permission: 'billing.read' },
  { path: '/disputes', label: 'Disputes', permission: 'disputes.read' },
  // Base /providers is the redirect entry + parent of the /providers/[id] management detail; reachable
  // with either permission. The status sub-routes split by domain (longest-prefix wins over base):
  //  - approved/suspended = active providers (providers.read)
  //  - pending-review/rejected = application lifecycle (provider_applications.read)
  {
    path: '/providers',
    label: 'All Providers',
    permission: ['providers.read', 'provider_applications.read'],
  },
  { path: '/providers/approved', label: 'Approved Providers', permission: 'providers.read' },
  { path: '/providers/suspended', label: 'Suspended Providers', permission: 'providers.read' },
  {
    path: '/providers/pending-review',
    label: 'Pending Review',
    permission: 'provider_applications.read',
  },
  { path: '/providers/rejected', label: 'Rejected', permission: 'provider_applications.read' },
  { path: '/providers/import', label: 'Import Providers', permission: 'providers.create' },
  {
    path: '/applications',
    label: 'Provider Applications',
    permission: 'provider_applications.read',
  },
  { path: '/camps', label: 'Camps', permission: 'camps.read' },
  { path: '/parents', label: 'Parents', permission: 'parents.read' },
  { path: '/catalogue', label: 'Activity Catalogue', permission: 'catalogue.read' },
  { path: '/kb/articles', label: 'Knowledge Base Articles', permission: 'kb.articles.read' },
  { path: '/kb/categories', label: 'Knowledge Base Categories', permission: 'kb.categories.read' },
  { path: '/users', label: 'Users', permission: 'users.read' },
  { path: '/roles', label: 'Roles', permission: 'roles.read' },
  { path: '/support', label: 'Support', permission: 'support_tickets.read' },
  { path: '/notifications', label: 'Notifications', public: true },
  { path: '/help', label: 'Help', public: true },
  { path: '/account', label: 'Account', public: true },
]

/**
 * Find the most specific (longest-prefix) route config for a pathname.
 */
export function matchRoute(pathname: string): RouteConfig | null {
  const matches = ROUTES.filter(r => pathname === r.path || pathname.startsWith(`${r.path}/`))
  if (matches.length === 0) return null
  return matches.reduce((best, r) => (r.path.length > best.path.length ? r : best))
}

/**
 * Get the first accessible route for a user based on their permissions
 * @param userPermissions - Array of permission IDs the user has
 * @returns The path of the first accessible route, or null if none found
 */
export function getFirstAccessibleRoute(userPermissions: string[]): string | null {
  for (const route of ROUTES) {
    if (isPermitted(route, userPermissions)) {
      return route.path
    }
  }
  return null
}

/**
 * Check if a user has access to a specific route.
 * Deny-by-default: routes not present in the config are treated as inaccessible.
 * @param pathname - The route path to check
 * @param userPermissions - Array of permission IDs the user has
 * @returns true if user has access, false otherwise
 */
export function hasRouteAccess(pathname: string, userPermissions: string[]): boolean {
  const route = matchRoute(pathname)
  if (!route) {
    // Fail closed: an unrecognised dashboard route is not accessible.
    return false
  }
  return isPermitted(route, userPermissions)
}

/**
 * Get all accessible routes for a user
 * @param userPermissions - Array of permission IDs the user has
 * @returns Array of accessible route paths
 */
export function getAccessibleRoutes(userPermissions: string[]): string[] {
  return ROUTES.filter(route => isPermitted(route, userPermissions)).map(route => route.path)
}
