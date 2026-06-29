/**
 * Permissions Configuration
 *
 * This file defines the permission structure for the application.
 * Permissions are organized into:
 * 1. Resource-based groups (users, roles, providers)
 * 2. Context-based main groups (superadmin, provider)
 *
 * Note: Children management is allowed to parents by default and doesn't require
 * explicit permission configuration. It uses role-based access control instead.
 */

export interface Permission {
  id: string
  name: string
}

export interface PermissionGroup {
  name: string
  permissions: Permission[]
}

export interface PermissionContext {
  name: string
  groups: PermissionGroup[]
}

// Resource-based permission groups
const usersPermissions: PermissionGroup = {
  name: 'Users',
  permissions: [
    { id: 'users.create', name: 'Create users' },
    { id: 'users.read', name: 'Read users' },
    { id: 'users.update', name: 'Update users' },
    { id: 'users.delete', name: 'Delete users' },
  ],
}

const rolesPermissions: PermissionGroup = {
  name: 'Roles',
  permissions: [
    { id: 'roles.create', name: 'Create roles' },
    { id: 'roles.read', name: 'Read roles' },
    { id: 'roles.update', name: 'Update roles' },
    { id: 'roles.delete', name: 'Delete roles' },
  ],
}

const providersPermissions: PermissionGroup = {
  name: 'Providers',
  permissions: [
    { id: 'providers.create', name: 'Create providers' },
    { id: 'providers.read', name: 'Read providers' },
    { id: 'providers.update', name: 'Update providers' },
    { id: 'providers.write', name: 'Write providers' },
    // `providers.delete` permission removed — providers are
    // not deletable post-onboarding (see superadmin providers controller).
  ],
}

const providerApplicationsPermissions: PermissionGroup = {
  name: 'Provider Applications',
  permissions: [
    { id: 'provider_applications.read', name: 'Read provider applications' },
    { id: 'provider_applications.approve', name: 'Approve provider applications' },
    { id: 'provider_applications.reject', name: 'Reject provider applications' },
    { id: 'provider_applications.request_info', name: 'Request additional information' },
  ],
}

const providerDocumentsPermissions: PermissionGroup = {
  name: 'Provider Documents',
  permissions: [
    { id: 'provider_documents.read', name: 'Read provider documents' },
    { id: 'provider_documents.review', name: 'Review provider documents' },
  ],
}

const campsPermissions: PermissionGroup = {
  name: 'Camps',
  permissions: [
    { id: 'camps.create', name: 'Create camps' },
    { id: 'camps.read', name: 'Read camps' },
    { id: 'camps.update', name: 'Update camps' },
    { id: 'camps.delete', name: 'Delete camps' },
    { id: 'camps.publish', name: 'Publish camps' },
  ],
}

// Superadmin's Camps section is currently read-only (view camps/sessions/bookings/reviews); camp &
// session import is gated by `providers.update` (provider management). This group holds the
// superadmin-specific camp permissions — add more here if superadmin camp management is introduced.
const superadminCampsPermissions: PermissionGroup = {
  name: 'Camps',
  permissions: [{ id: 'camps.read', name: 'Read camps' }],
}

const addonsPermissions: PermissionGroup = {
  name: 'Add-ons',
  permissions: [
    { id: 'addons.create', name: 'Create add-ons' },
    { id: 'addons.read', name: 'Read add-ons' },
    { id: 'addons.update', name: 'Update add-ons' },
    { id: 'addons.delete', name: 'Delete add-ons' },
  ],
}

const bookingsPermissions: PermissionGroup = {
  name: 'Bookings',
  permissions: [
    { id: 'bookings.read', name: 'Read bookings' },
    { id: 'bookings.write', name: 'Write bookings' },
  ],
}

const messagesPermissions: PermissionGroup = {
  name: 'Messaging',
  permissions: [
    { id: 'messages.read', name: 'View and receive messages' },
    { id: 'messages.write', name: 'Send and reply to messages' },
  ],
}

const dashboardPermissions: PermissionGroup = {
  name: 'Dashboard',
  permissions: [{ id: 'provider_dashboard.read', name: 'View the provider dashboard' }],
}

const kbCategoriesPermissions: PermissionGroup = {
  name: 'Knowledge Base Categories',
  permissions: [
    { id: 'kb.categories.create', name: 'Create KB categories' },
    { id: 'kb.categories.read', name: 'Read KB categories' },
    { id: 'kb.categories.update', name: 'Update KB categories' },
    { id: 'kb.categories.delete', name: 'Delete KB categories' },
  ],
}

const kbArticlesPermissions: PermissionGroup = {
  name: 'Knowledge Base Articles',
  permissions: [
    { id: 'kb.articles.create', name: 'Create KB articles' },
    { id: 'kb.articles.read', name: 'Read KB articles' },
    { id: 'kb.articles.update', name: 'Update KB articles' },
    { id: 'kb.articles.delete', name: 'Delete KB articles' },
    { id: 'kb.articles.publish', name: 'Publish KB articles' },
    { id: 'kb.articles.duplicate', name: 'Duplicate KB articles' },
  ],
}

const supportTicketsPermissions: PermissionGroup = {
  name: 'Support Tickets',
  permissions: [
    { id: 'support_tickets.read', name: 'Read support tickets' },
    { id: 'support_tickets.update', name: 'Update support tickets' },
    { id: 'support_tickets.assign', name: 'Assign support tickets' },
    { id: 'support_tickets.delete', name: 'Delete support tickets' },
  ],
}

const parentsPermissions: PermissionGroup = {
  name: 'Parents',
  permissions: [{ id: 'parents.read', name: 'Read parents' }],
}

const disputesPermissions: PermissionGroup = {
  name: 'Disputes',
  permissions: [
    { id: 'disputes.read', name: 'Read disputes (list + detail)' },
    {
      id: 'disputes.write',
      name: 'Submit dispute evidence and manually override outcomes',
    },
  ],
}

// reimbursements + force-majeure refund triggers ship with `billing.read`
// and `billing.write`. They were never registered in this config, so granular
// role-based assignment was effectively impossible (only the wildcard role
// could call them).
const billingPermissions: PermissionGroup = {
  name: 'Billing',
  permissions: [
    { id: 'billing.read', name: 'Read billing (reimbursements list + detail)' },
    {
      id: 'billing.write',
      name: 'Trigger refunds, settle/write-off reimbursements, force-majeure cancel',
    },
  ],
}

const analyticsPermissions: PermissionGroup = {
  name: 'Analytics Dashboard',
  permissions: [{ id: 'analytics.read', name: 'View the platform analytics dashboard' }],
}

const financialPermissions: PermissionGroup = {
  name: 'Financial Dashboard',
  permissions: [
    {
      id: 'financial.read',
      name: 'View the financial dashboard (revenue, Stripe balance, payouts)',
    },
  ],
}

const cataloguePermissions: PermissionGroup = {
  name: 'Activity Catalogue',
  permissions: [
    { id: 'catalogue.read', name: 'Read the activity catalogue' },
    { id: 'catalogue.create', name: 'Create catalogue items (categories, activities, scales)' },
    { id: 'catalogue.update', name: 'Update catalogue items' },
    { id: 'catalogue.delete', name: 'Delete catalogue items' },
  ],
}

// Context-based main groups
export const superadminContext: PermissionContext = {
  name: 'SuperAdmin',
  groups: [
    usersPermissions,
    rolesPermissions,
    providersPermissions,
    providerApplicationsPermissions,
    providerDocumentsPermissions,
    superadminCampsPermissions,
    cataloguePermissions,
    kbCategoriesPermissions,
    kbArticlesPermissions,
    supportTicketsPermissions,
    parentsPermissions,
    billingPermissions,
    disputesPermissions,
    analyticsPermissions,
    financialPermissions,
  ],
}

export const providerContext: PermissionContext = {
  name: 'Provider',
  groups: [
    dashboardPermissions,
    usersPermissions,
    rolesPermissions,
    campsPermissions,
    addonsPermissions,
    bookingsPermissions,
    messagesPermissions,
  ],
}

/**
 * Get all unique permissions from all contexts
 * This is used for seeding the permissions table
 */
export function getAllPermissions(): Permission[] {
  const allPermissions = new Map<string, Permission>()

  const contexts = [superadminContext, providerContext]

  for (const context of contexts) {
    for (const group of context.groups) {
      for (const permission of group.permissions) {
        allPermissions.set(permission.id, permission)
      }
    }
  }

  return Array.from(allPermissions.values())
}

/**
 * Get all permissions for a specific context
 */
export function getContextPermissions(context: PermissionContext): Permission[] {
  const permissions: Permission[] = []

  for (const group of context.groups) {
    permissions.push(...group.permissions)
  }

  return permissions
}

/**
 * Get permission IDs for a specific context
 */
export function getContextPermissionIds(context: PermissionContext): string[] {
  return getContextPermissions(context).map(p => p.id)
}
