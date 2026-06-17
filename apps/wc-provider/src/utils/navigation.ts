/**
 * Navigation Utilities
 *
 * Single source of truth for "dashboard section -> required permission". This config is consumed
 * by BOTH the sidebar (to decide which items are visible) and the RouteGuard (to decide which
 * routes a user may access), so the two can never drift.
 *
 * Matching is longest-prefix based, so `/users` also covers `/users/create` and
 * `/users/[id]/edit`. Create/edit pages that need a stricter permission than the section's read
 * permission additionally self-guard at the page level (see the relevant create/edit pages).
 *
 * RouteGuard is DENY-BY-DEFAULT for dashboard routes: a route must either declare a `permission`
 * or be explicitly marked `public`. A new dashboard route with no entry here is treated as
 * inaccessible (fail closed) rather than silently exposed.
 */

interface RouteConfig {
  path: string
  /** Required permission to access this route (and its children). */
  permission?: string
  /** Accessible to any authenticated user, no permission required. */
  public?: boolean
  label: string
}

/**
 * All dashboard routes in priority order (first accessible one is the post-login landing).
 */
export const ROUTES: RouteConfig[] = [
  { path: '/dashboard', label: 'Dashboard', permission: 'provider_dashboard.read' },
  { path: '/bookings', label: 'Bookings', permission: 'bookings.read' },
  { path: '/messages', label: 'Messages', permission: 'messages.read' },
  { path: '/camps', label: 'Camps', permission: 'camps.read' },
  { path: '/add-ons', label: 'Add-ons', permission: 'addons.read' },
  { path: '/users', label: 'Users', permission: 'users.read' },
  { path: '/roles', label: 'Roles', permission: 'roles.read' },
  { path: '/notifications', label: 'Notifications', public: true },
  { path: '/help', label: 'Help', public: true },
  { path: '/support', label: 'Support', public: true },
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
    if (route.public || !route.permission) {
      return route.path
    }
    if (userPermissions.includes(route.permission)) {
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
  if (route.public || !route.permission) {
    return true
  }
  return userPermissions.includes(route.permission)
}

/**
 * Get all accessible routes for a user
 * @param userPermissions - Array of permission IDs the user has
 * @returns Array of accessible route paths
 */
export function getAccessibleRoutes(userPermissions: string[]): string[] {
  return ROUTES.filter(route => {
    if (route.public || !route.permission) return true
    return userPermissions.includes(route.permission)
  }).map(route => route.path)
}
