# Knowledge Base Permissions Configuration

## Overview
All necessary permissions for the Knowledge Base (KB) module have been added to the permissions configuration file.

---

## File Updated
**Location:** `world-schools/apps/wc-nest-api/src/config/permissions.ts`

---

## Permissions Added

### 1. **Knowledge Base Categories Permissions**

```typescript
const kbCategoriesPermissions: PermissionGroup = {
  name: 'Knowledge Base Categories',
  permissions: [
    { id: 'kb.categories.create', name: 'Create KB categories' },
    { id: 'kb.categories.read', name: 'Read KB categories' },
    { id: 'kb.categories.update', name: 'Update KB categories' },
    { id: 'kb.categories.delete', name: 'Delete KB categories' },
  ],
}
```

**Permission IDs:**
- `kb.categories.create` - Create new article categories
- `kb.categories.read` - View article categories
- `kb.categories.update` - Update existing categories (includes reordering)
- `kb.categories.delete` - Delete categories (only if no articles)

---

### 2. **Knowledge Base Articles Permissions**

```typescript
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
```

**Permission IDs:**
- `kb.articles.create` - Create new articles (draft status)
- `kb.articles.read` - View all articles (including drafts)
- `kb.articles.update` - Update articles (includes managing related articles)
- `kb.articles.delete` - Delete articles
- `kb.articles.publish` - Publish/unpublish articles
- `kb.articles.duplicate` - Duplicate existing articles

---

## Context Assignment

### SuperAdmin Context
Both KB permission groups have been added to the `superadminContext`:

```typescript
export const superadminContext: PermissionContext = {
  name: 'SuperAdmin',
  groups: [
    usersPermissions,
    rolesPermissions,
    providersPermissions,
    providerApplicationsPermissions,
    providerDocumentsPermissions,
    campsPermissions,
    addonsPermissions,
    kbCategoriesPermissions,      // ✅ Added
    kbArticlesPermissions,         // ✅ Added
  ],
}
```

### Provider Context
KB permissions are **NOT** included in the `providerContext` as the Knowledge Base is managed exclusively by SuperAdmins.

---

## Controller Mapping

### Article Categories Controller
**File:** `article-categories/article-categories.controller.ts`

| Endpoint | Method | Permission(s) |
|----------|--------|---------------|
| Create category | POST | `kb.categories.create` |
| List categories | GET | `kb.categories.read` |
| Get category | GET | `kb.categories.read` |
| Update category | PATCH | `kb.categories.update` |
| Reorder category | PATCH | `kb.categories.update` |
| Delete category | DELETE | `kb.categories.delete` |
| Check slug | GET | `kb.categories.create`, `kb.categories.update` |

### Articles Controller
**File:** `articles/articles.controller.ts`

| Endpoint | Method | Permission(s) |
|----------|--------|---------------|
| Create article | POST | `kb.articles.create` |
| List articles | GET | `kb.articles.read` |
| Get article | GET | `kb.articles.read` |
| Update article | PATCH | `kb.articles.update` |
| Delete article | DELETE | `kb.articles.delete` |
| Publish article | POST | `kb.articles.publish` |
| Unpublish article | POST | `kb.articles.publish` |
| Duplicate article | POST | `kb.articles.duplicate` |
| Check slug | GET | `kb.articles.create`, `kb.articles.update` |
| Get related articles | GET | `kb.articles.read` |
| Add related article | POST | `kb.articles.update` |
| Remove related article | DELETE | `kb.articles.update` |
| Reorder related articles | PATCH | `kb.articles.update` |

---

## Database Seeding

### How Permissions Are Seeded

The permissions are automatically seeded via the `seed.ts` script:

```typescript
// From prisma/seed.ts
const permissions = getAllPermissions()

for (const permission of permissions) {
  await prisma.permission.upsert({
    where: { id: permission.id },
    update: {},
    create: permission,
  })
}
```

### Running the Seed Script

```bash
# Seed the database with all permissions
npx prisma db seed
```

This will create all 10 KB permissions in the database:
- 4 category permissions
- 6 article permissions

---

## Role Assignment

### Super Admin Role
The Super Admin role automatically receives all KB permissions via the `superadminContext`:

```typescript
const superAdminPermissionIds = getContextPermissionIds(superadminContext)
// This includes all kb.categories.* and kb.articles.* permissions
```

---

## Verification

### Check Permissions in Database
```sql
SELECT * FROM permissions WHERE id LIKE 'kb.%' ORDER BY id;
```

Expected results (10 rows):
```
kb.articles.create
kb.articles.delete
kb.articles.duplicate
kb.articles.publish
kb.articles.read
kb.articles.update
kb.categories.create
kb.categories.delete
kb.categories.read
kb.categories.update
```

---

## Status: ✅ COMPLETE

All KB permissions have been:
- ✅ Added to `permissions.ts`
- ✅ Assigned to `superadminContext`
- ✅ Mapped to controller endpoints
- ✅ Ready for database seeding
- ✅ Compatible with existing permission system

Run `npx prisma db seed` to create these permissions in the database.

