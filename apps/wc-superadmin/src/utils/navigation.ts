/**
 * Navigation Utilities
 *
 * Helper functions for navigation and route authorization
 */

/**
 * Route configuration with permission requirements
 */
interface RouteConfig {
  path: string
  permission?: string
  label: string
}

/**
 * Define all routes in priority order
 * Routes without permissions are accessible to all authenticated users
 * Routes with permissions require the user to have that specific permission
 */
export const ROUTES: RouteConfig[] = [
  {
    path: '/analytics-dashboard',
    label: 'Analytics Dashboard',
    // No permission required - available to all
  },
  {
    path: '/financial-dashboard',
    label: 'Financial Dashboard',
    // No permission required - available to all
  },
  {
    path: '/users',
    permission: 'users.read',
    label: 'Users',
  },
  {
    path: '/roles',
    permission: 'roles.read',
    label: 'Roles',
  },
  {
    path: '/all-providers',
    permission: 'providers.read',
    label: 'All Providers',
  },
  {
    path: '/provider-requests',
    permission: 'provider_applications.read',
    label: 'Provider Requests',
  },
  {
    path: '/notifications',
    label: 'Notifications',
    // No permission required - available to all
  },
]

/**
 * Get the first accessible route for a user based on their permissions
 * @param userPermissions - Array of permission IDs the user has
 * @returns The path of the first accessible route, or null if none found
 */
export function getFirstAccessibleRoute(userPermissions: string[]): string | null {
  for (const route of ROUTES) {
    // If route has no permission requirement, it's accessible
    if (!route.permission) {
      return route.path
    }
    // Check if user has the required permission
    if (userPermissions.includes(route.permission)) {
      return route.path
    }
  }
  return null
}

/**
 * Check if a user has access to a specific route
 * @param routePath - The route path to check
 * @param userPermissions - Array of permission IDs the user has
 * @returns true if user has access, false otherwise
 */
export function hasRouteAccess(routePath: string, userPermissions: string[]): boolean {
  const route = ROUTES.find(r => r.path === routePath)
  if (!route) {
    // Route not found in config - allow access (might be a dynamic route)
    return true
  }
  // If route has no permission requirement, it's accessible
  if (!route.permission) {
    return true
  }
  // Check if user has the required permission
  return userPermissions.includes(route.permission)
}

/**
 * Get all accessible routes for a user
 * @param userPermissions - Array of permission IDs the user has
 * @returns Array of accessible route paths
 */
export function getAccessibleRoutes(userPermissions: string[]): string[] {
  return ROUTES.filter(route => {
    if (!route.permission) return true
    return userPermissions.includes(route.permission)
  }).map(route => route.path)
}
