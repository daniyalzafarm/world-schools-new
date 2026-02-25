# Parent Account Section Revamp - Implementation Plan

## Overview
Revamp the Parent Account/Profile section to match the design system and implementation patterns used in the Children Detail pages.

## Current State Analysis

### Existing Implementation
- **Current Route**: `/settings`
- **Location**: `apps/wc-booking/src/app/settings/`
- **Current Pages**: 
  - `/settings/profile` - Basic profile page with accordion layout
- **Current Components**:
  - `SettingsSidebar` - Minimal sidebar with only Profile link
  - `SettingsLayout` - Layout wrapper with sidebar

### Reference Design Files
- **Location**: `/Users/daniyal/files/dev/danidev/booking-design/Parents/account/`
- **Structure**:
  ```
  account/
  ├── parent_account-hub.html (main overview)
  ├── profile/
  │   ├── parent_personal-info.html
  │   └── parent_contact-details.html
  ├── billing/
  │   ├── parent_payment-methods.html
  │   └── parent_receipts-invoices.html
  └── settings/
      ├── parent_account-settings.html
      ├── parent_notification-preferences.html
      ├── parent_privacy-data.html
      └── parent_security-settings.html
  ```

### Children Detail Pattern (Reference Implementation)
- **Route**: `/children/[id]`
- **Layout**: Dual-sidebar (main app + children-specific)
- **Components**:
  - `ChildrenSidebar` - Full-featured sidebar with child selector + navigation
  - `ChildDetailLayout` - Layout with sidebar, mobile header, content area, footer
  - `ChildDetailProvider` - Context for shared state
  - `ChildDetailFooter` - Sticky footer with form actions
- **Key Features**:
  - Absolute positioning to escape dashboard layout
  - Mobile-responsive with overlay and toggle
  - Section-based navigation with icons and badges
  - Sticky footer for form actions
  - Context provider for state management

---

## Implementation Plan

### Phase 1: Route Restructuring
**Goal**: Rename `/settings` to `/account` and create nested route structure

#### 1.1 Rename Route Directory
- Move `apps/wc-booking/src/app/settings/` → `apps/wc-booking/src/app/account/`
- Update all internal imports and references

#### 1.2 Create Nested Route Structure
Based on reference design, create the following routes:
```
account/
├── layout.tsx (main account layout)
├── page.tsx (account hub/overview)
├── profile/
│   ├── personal-info/
│   │   └── page.tsx
│   └── contact-details/
│       └── page.tsx
├── billing/
│   ├── payment-methods/
│   │   └── page.tsx
│   └── receipts/
│       └── page.tsx
└── settings/
    ├── notifications/
    │   └── page.tsx
    ├── security/
    │   └── page.tsx
    ├── account-settings/
    │   └── page.tsx
    └── privacy/
        └── page.tsx
```

### Phase 2: Component Development
**Goal**: Create account-specific components following Children Detail patterns

#### 2.1 Create AccountSidebar Component
**File**: `components/layout/account-sidebar.tsx`
**Pattern**: Based on `ChildrenSidebar`
**Features**:
- Navigation sections matching reference design:
  - Profile (Personal info, Contact details)
  - Payments (Payment methods, Receipts & invoices)
  - Settings (Notifications, Login & security)
  - Account (Account Settings, Privacy & Data)
- Mobile overlay and responsive behavior
- Active state highlighting
- Icons from lucide-react

#### 2.2 Update AccountLayout
**File**: `app/account/layout.tsx`
**Pattern**: Based on `ChildDetailLayout`
**Features**:
- Absolute positioning to escape dashboard layout
- AccountSidebar integration
- Mobile header with menu toggle
- Flex column layout with scrollable content
- Optional sticky footer (if needed for forms)

#### 2.3 Create AccountContext (if needed)
**File**: `components/account/AccountContext.tsx`
**Pattern**: Based on `ChildDetailContext`
**Purpose**: Share state between account pages and components
**State**: Form dirty state, save handlers, etc.

### Phase 3: Page Implementation
**Goal**: Implement all account pages matching reference designs

#### 3.1 Account Hub (Overview)
**File**: `app/account/page.tsx`
**Reference**: `parent_account-hub.html`
**Features**:
- Profile completion card
- Quick stats (children, bookings, etc.)
- Section cards with completion status
- Navigation to sub-pages

#### 3.2 Profile Pages
**Files**: 
- `app/account/profile/personal-info/page.tsx`
- `app/account/profile/contact-details/page.tsx`
**Reference**: 
- `profile/parent_personal-info.html`
- `profile/parent_contact-details.html`
**Features**:
- Form fields matching reference design
- Photo upload (personal info)
- Phone input with country code
- Address fields
- Save/Cancel actions

#### 3.3 Billing Pages
**Files**:
- `app/account/billing/payment-methods/page.tsx`
- `app/account/billing/receipts/page.tsx`
**Reference**:
- `billing/parent_payment-methods.html`
- `billing/parent_receipts-invoices.html`
**Features**:
- Payment method cards (Stripe integration)
- Add/remove payment methods
- Receipts list with filters
- Download invoice functionality

#### 3.4 Settings Pages
**Files**:
- `app/account/settings/notifications/page.tsx`
- `app/account/settings/security/page.tsx`
- `app/account/settings/account-settings/page.tsx`
- `app/account/settings/privacy/page.tsx`
**Reference**:
- `settings/parent_notification-preferences.html`
- `settings/parent_security-settings.html`
- `settings/parent_account-settings.html`
- `settings/parent_privacy-data.html`
**Features**:
- Notification toggles by category
- Password change form
- 2FA setup
- Account deactivation/deletion (GDPR)
- Data export functionality

---

## Code Patterns to Follow

### 1. Layout Pattern (from ChildDetailLayout)
```tsx
'use client'
import { useState, useEffect } from 'react'
import eventBus from '@/utils/event-bus'

// Absolute positioning to escape dashboard layout
<div className="absolute inset-0 lg:left-0">
  <div className="flex h-full bg-white dark:bg-slate-900">
    <AccountSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

    {/* Mobile Header */}
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50">
      {/* Menu toggle button */}
    </div>

    {/* Main Content */}
    <main className="flex-1 min-w-0 lg:ml-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </main>
  </div>
</div>

// Emit sidebar collapse event on mount
useEffect(() => {
  eventBus.$emit('sidebar:collapse')
}, [])
```

### 2. Sidebar Pattern (from ChildrenSidebar)
```tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@world-schools/ui-web'

// Mobile overlay
{sidebarOpen && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
       onClick={() => setSidebarOpen(false)} />
)}

// Sidebar with responsive classes
<aside className={cn(
  'h-full bg-white dark:bg-slate-900/95 backdrop-blur-md',
  'border-r border-slate-200 dark:border-slate-700',
  'fixed lg:static z-40',
  sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
  'transition-all duration-300 ease-in-out',
  'w-full lg:w-70',
  'pt-8 lg:pt-0'
)}>
  {/* Navigation sections */}
</aside>
```

### 3. Navigation Structure
```tsx
interface NavigationSection {
  title?: string
  items: NavigationItem[]
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  badgeType?: 'count' | 'warning' | 'success'
}

const navigationSections: NavigationSection[] = [
  {
    title: 'Profile',
    items: [
      { name: 'Personal info', href: '/account/profile/personal-info', icon: <User /> },
      { name: 'Contact details', href: '/account/profile/contact-details', icon: <Phone /> }
    ]
  },
  // ... more sections
]
```

### 4. Active State Logic
```tsx
const isActive = (href: string) => {
  return pathname === href || pathname.startsWith(href + '/')
}
```

---

## Update Requirements

### Files to Update
1. **Navigation Links**: Update all references from `/settings` to `/account`
   - Main sidebar component
   - Any hardcoded links in other components
   - Route guards and redirects

2. **Component Renames**:
   - `SettingsSidebar` → `AccountSidebar`
   - `SettingsLayout` → `AccountLayout`

3. **Import Paths**: Update all imports referencing the old settings directory

---

## Testing Checklist

### Functionality
- [ ] All routes accessible and render correctly
- [ ] Sidebar navigation works on desktop and mobile
- [ ] Mobile overlay closes on navigation
- [ ] Active state highlights correct menu item
- [ ] Main sidebar collapses when account pages load
- [ ] Forms save data correctly
- [ ] Form validation works as expected

### Responsive Design
- [ ] Desktop: Dual-sidebar layout displays correctly
- [ ] Tablet: Responsive breakpoints work
- [ ] Mobile: Sidebar becomes overlay
- [ ] Mobile: Header toggle button works
- [ ] Mobile: Overlay closes on outside click

### Code Quality
- [ ] TypeScript types are correct
- [ ] No console errors or warnings
- [ ] Code follows existing patterns
- [ ] Components are properly documented
- [ ] Accessibility attributes present

---

## Implementation Order

1. **Phase 1: Route Restructuring** (Start here)
   - Rename `/settings` to `/account`
   - Create nested route directories
   - Update all route references

2. **Phase 2: Component Development**
   - Create `AccountSidebar` component
   - Update `AccountLayout` component
   - Create context if needed

3. **Phase 3: Page Implementation**
   - Start with Account Hub (overview)
   - Implement Profile pages
   - Implement Billing pages
   - Implement Settings pages

---

## Notes

- **No backward compatibility needed**: App is not yet live
- **Follow Children Detail patterns exactly**: Same code structure, naming conventions, styling
- **Use HeroUI v3 components**: Button, Input, Card, etc.
- **Maintain TypeScript type safety**: Define proper interfaces
- **GDPR compliance**: Privacy page must include data export, deactivation, deletion
- **Stripe integration**: Payment methods page will need Stripe Elements

---

## Success Criteria

✅ All 8 account pages implemented and functional
✅ Sidebar navigation matches reference design
✅ Mobile responsive behavior works correctly
✅ Code patterns match Children Detail implementation
✅ TypeScript compilation passes without errors
✅ All existing functionality preserved
✅ No console errors or warnings


