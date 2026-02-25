# Account Profile Pages Revamp - Implementation Plan

## Overview

This plan outlines the comprehensive revamp of three account profile pages in the `wc-booking` app to match their reference HTML designs. The key architectural change is **migrating from inline forms to modal-based forms**, following the pattern established in the Security Settings page.

### Pages to Revamp

1. **Personal Info Page** - `/account/profile/personal-info`
2. **Contact Details Page** - `/account/profile/contact-details`
3. **Account Settings Page** - `/account/settings/account-settings`

### Key Changes Summary

| Page | Current State | Target State | Main Changes |
|------|--------------|--------------|--------------|
| Personal Info | Inline accordion forms | Modal-based editing | Profile photo section, modal forms for name/nationality/languages |
| Contact Details | "Coming Soon" placeholder | Full implementation | Email/phone/address with verification badges, modal forms |
| Account Settings | "Coming Soon" placeholder | Full implementation | Login email management, account details display |

### Design Pattern Reference

**Reference Implementation:** `/account/settings/security/page.tsx`

This page demonstrates the correct patterns for:
- Modal-based form editing
- HeroUI v2.8.7 component usage (Modal, Button, Input, Switch)
- Toast notifications using `addToast` from `@heroui/react`
- Service layer integration
- Loading states and error handling
- Clean section-based layout

---

## Technical Stack

- **UI Framework:** HeroUI v2.8.7 (NOT v3)
- **Styling:** Tailwind CSS v4
- **State Management:** React hooks + Zustand (auth-store)
- **API Client:** Custom `apiClient` from `@/utils/api-client`
- **Icons:** lucide-react
- **Form Components:** `@world-schools/ui-web` (Input component)

---

## Phase 1: Personal Info Page Revamp

### Current Implementation Analysis

**File:** `apps/wc-booking/src/app/(dashboard)/account/profile/personal-info/page.tsx`

**Issues:**
- Uses inline accordion forms (not matching design)
- Mixes profile data with password reset (password should be in security page)
- No profile photo upload section
- No nationality or languages fields
- Form layout doesn't match reference design

### Target Design Analysis

**Reference:** `booking-design/Parents/account/profile/parent_personal-info.html`

**Key Features:**
- Profile photo section with upload/remove buttons
- Info rows with "Edit" buttons that open modals
- Three editable fields:
  1. Legal name (first + last name)
  2. Nationality (primary + optional secondary)
  3. Languages spoken (checkbox list)
- Modal-based editing for each field
- Toast notifications on save

### Implementation Tasks

#### 1.1 Remove Password Reset Section
- **File:** `apps/wc-booking/src/app/(dashboard)/account/profile/personal-info/page.tsx`
- **Action:** Delete the entire "Reset Password" AccordionItem (lines 373-514)
- **Reason:** Password management belongs in Security Settings page

#### 1.2 Create Profile Photo Component
- **File:** `apps/wc-booking/src/components/account/profile-photo-section.tsx` (NEW)
- **Content:**
  - Avatar display (96x96px, circular)
  - Upload photo button
  - Remove photo button
  - Uses HeroUI Button component
  - Handles file upload logic

#### 1.3 Create Info Row Component
- **File:** `apps/wc-booking/src/components/account/info-row.tsx` (NEW)
- **Props:** `label`, `value`, `onEdit`
- **Styling:** Matches reference design (hover effect, underlined Edit button)

#### 1.4 Create Modal Components

**1.4.1 Legal Name Modal**
- **File:** `apps/wc-booking/src/components/account/modals/legal-name-modal.tsx` (NEW)
- **Fields:** First name, Last name (side-by-side grid)
- **Validation:** Required fields
- **API:** PATCH `/user/auth/profile` with `{ firstName, lastName }`

**1.4.2 Nationality Modal**
- **File:** `apps/wc-booking/src/components/account/modals/nationality-modal.tsx` (NEW)
- **Fields:** 
  - Primary nationality (select/dropdown)
  - Secondary nationality (select/dropdown, optional)
- **API:** PATCH `/user/auth/profile` with `{ primaryNationality, secondaryNationality }`

**1.4.3 Languages Modal**
- **File:** `apps/wc-booking/src/components/account/modals/languages-modal.tsx` (NEW)
- **Fields:** Checkbox list of languages
- **Languages:** English, French, German, Spanish, Italian, Portuguese, Dutch, Russian, Mandarin, Arabic
- **API:** PATCH `/user/auth/profile` with `{ languages: string[] }`

#### 1.5 Update Page Layout
- **File:** `apps/wc-booking/src/app/(dashboard)/account/profile/personal-info/page.tsx`
- **Structure:**
  ```tsx
  <div className="min-h-full w-full bg-white dark:bg-gray-900">
    {/* Page Header */}
    <div className="mb-10">
      <h1>Personal info</h1>
      <p>This is how camps will see you on World-Camps.</p>
    </div>

    {/* Profile Photo Section */}
    <ProfilePhotoSection />

    {/* Info Rows */}
    <InfoRow label="Legal name" value="Sarah Miller" onEdit={() => openModal('name')} />
    <InfoRow label="Nationality" value="Swiss, British" onEdit={() => openModal('nationality')} />
    <InfoRow label="Languages spoken" value="English, French, German" onEdit={() => openModal('languages')} />

    {/* Modals */}
    <LegalNameModal isOpen={modals.name} onClose={() => closeModal('name')} />
    <NationalityModal isOpen={modals.nationality} onClose={() => closeModal('nationality')} />
    <LanguagesModal isOpen={modals.languages} onClose={() => closeModal('languages')} />
  </div>
  ```

#### 1.6 Update Profile Service
- **File:** `apps/wc-booking/src/services/profile.services.ts`
- **Add to UpdateProfileDto:**
  ```typescript
  primaryNationality?: string
  secondaryNationality?: string
  languages?: string[]
  profilePhotoUrl?: string
  ```

#### 1.7 Backend Requirements
- **Endpoint:** PATCH `/user/auth/profile`
- **New fields to support:**
  - `primaryNationality: string`
  - `secondaryNationality: string | null`
  - `languages: string[]`
  - `profilePhotoUrl: string | null`
- **Database:** Add columns to `parent` table if not exists

---

## Phase 2: Contact Details Page Revamp

### Current Implementation Analysis

**File:** `apps/wc-booking/src/app/(dashboard)/account/profile/contact-details/page.tsx`

**Issues:**
- Currently shows "Coming Soon" placeholder
- No functionality implemented

### Target Design Analysis

**Reference:** `booking-design/Parents/account/profile/parent_contact-details.html`

**Key Features:**
- Three main sections with verification badges:
  1. Email address (verified badge, used for booking confirmations)
  2. Phone number (verified badge, for urgent matters)
  3. Home address (multi-line display)
- Each section has "Edit" button opening modal
- Verification status indicators (green badge with checkmark)
- Helper text under each field

### Implementation Tasks

#### 2.1 Create Contact Details Page Structure
- **File:** `apps/wc-booking/src/app/(dashboard)/account/profile/contact-details/page.tsx`
- **Replace entire content with:**
  - Page header (title + subtitle)
  - Three info rows (email, phone, address)
  - Three modals (email, phone, address)
  - Loading states
  - Toast notifications

#### 2.2 Create Verification Badge Component
- **File:** `apps/wc-booking/src/components/account/verification-badge.tsx` (NEW)
- **Props:** `verified: boolean`
- **Styling:** Green background, checkmark icon, "Verified" text
- **Uses:** lucide-react Check icon

#### 2.3 Create Modal Components

**2.3.1 Email Modal**
- **File:** `apps/wc-booking/src/components/account/modals/email-modal.tsx` (NEW)
- **Fields:**
  - Current email (disabled/readonly)
  - New email address (input)
- **Button:** "Send verification" (instead of "Save")
- **API:** POST `/user/auth/email/change-request` with `{ newEmail }`
- **Flow:** Sends verification email, shows success toast

**2.3.2 Phone Modal**
- **File:** `apps/wc-booking/src/components/account/modals/phone-modal.tsx` (NEW)
- **Fields:**
  - Country code (select: +41, +33, +44, +49, +1, etc.)
  - Phone number (input)
- **Layout:** Flex row with country code dropdown + phone input
- **Button:** "Verify number"
- **API:** POST `/user/auth/phone/change-request` with `{ countryCode, phoneNumber }`
- **Flow:** Sends SMS verification code

**2.3.3 Address Modal**
- **File:** `apps/wc-booking/src/components/account/modals/address-modal.tsx` (NEW)
- **Fields:**
  - Street address (input)
  - Apt, suite, etc. (input, optional)
  - City (input)
  - Postal code (input)
  - Country (select)
- **Layout:** Grid layout (2 columns for city/postal code)
- **API:** PATCH `/user/auth/profile` with address fields

#### 2.4 Create Contact Services
- **File:** `apps/wc-booking/src/services/contact.services.ts` (NEW)
- **Functions:**
  ```typescript
  requestEmailChange(newEmail: string): Promise<ApiResult>
  verifyEmailChange(token: string): Promise<ApiResult>
  requestPhoneChange(countryCode: string, phoneNumber: string): Promise<ApiResult>
  verifyPhoneChange(code: string): Promise<ApiResult>
  ```

#### 2.5 Update Profile Service
- **File:** `apps/wc-booking/src/services/profile.services.ts`
- **Add to UserProfile interface:**
  ```typescript
  emailVerified?: boolean
  phoneVerified?: boolean
  ```

#### 2.6 Backend Requirements
- **New Endpoints:**
  - POST `/user/auth/email/change-request` - Initiates email change
  - POST `/user/auth/email/verify` - Verifies email with token
  - POST `/user/auth/phone/change-request` - Initiates phone change
  - POST `/user/auth/phone/verify` - Verifies phone with SMS code
- **Email Service:** Send verification emails
- **SMS Service:** Send verification SMS codes
- **Database:** Add `emailVerified`, `phoneVerified` boolean columns

---

## Phase 3: Account Settings Page Revamp

### Current Implementation Analysis

**File:** `apps/wc-booking/src/app/(dashboard)/account/settings/account-settings/page.tsx`

**Issues:**
- Currently shows "Coming Soon" placeholder
- No functionality implemented

### Target Design Analysis

**Reference:** `booking-design/Parents/account/settings/parent_account-settings.html`

**Key Features:**
- Two main sections:
  1. Login email (with verified badge, "Change" link)
  2. Account details (read-only: account created date, account type)
- Modal for changing login email (requires password confirmation)
- Clean, minimal layout

### Implementation Tasks

#### 3.1 Create Account Settings Page Structure
- **File:** `apps/wc-booking/src/app/(dashboard)/account/settings/account-settings/page.tsx`
- **Structure:**
  ```tsx
  <div className="min-h-full w-full bg-white dark:bg-gray-900">
    {/* Page Header */}
    <div className="mb-10">
      <h1>Account Settings</h1>
      <p>Manage your login email and account preferences.</p>
    </div>

    {/* Login Email Section */}
    <section className="mb-10">
      <h2>Login email</h2>
      <p>The email you use to sign in to World-Camps</p>
      <SettingRow
        label="Email address"
        value={user.email}
        badge={<VerificationBadge verified={true} />}
        action={<Button onClick={openEmailModal}>Change</Button>}
      />
    </section>

    {/* Account Details Section */}
    <section className="mb-10">
      <h2>Account details</h2>
      <p>Basic information about your account</p>
      <SettingRow label="Account created" value="March 15, 2024" />
      <SettingRow label="Account type" value="Parent account" />
    </section>

    {/* Change Email Modal */}
    <ChangeLoginEmailModal />
  </div>
  ```

#### 3.2 Create Setting Row Component
- **File:** `apps/wc-booking/src/components/account/setting-row.tsx` (NEW)
- **Props:** `label`, `value`, `description?`, `badge?`, `action?`
- **Styling:** Flex layout, border-bottom separator
- **Pattern:** Matches Security Settings page layout

#### 3.3 Create Change Login Email Modal
- **File:** `apps/wc-booking/src/components/account/modals/change-login-email-modal.tsx` (NEW)
- **Fields:**
  - Current email (disabled/readonly)
  - New email address (input)
  - Confirm password (password input, required for security)
- **Validation:**
  - Email format validation
  - Password required
  - Email must be different from current
- **API:** POST `/user/auth/login-email/change-request` with `{ newEmail, password }`
- **Flow:** Sends verification email to new address

#### 3.4 Add Account Metadata to Profile
- **File:** `apps/wc-booking/src/services/profile.services.ts`
- **Add to UserProfile interface:**
  ```typescript
  createdAt: string
  accountType: 'parent' | 'provider' | 'admin'
  ```

#### 3.5 Backend Requirements
- **New Endpoint:**
  - POST `/user/auth/login-email/change-request` - Requires password, sends verification
  - POST `/user/auth/login-email/verify` - Verifies and updates login email
- **Security:** Verify current password before allowing email change
- **Email Service:** Send verification email to new address
- **Database:** Update user email after verification

---

## Shared Components to Create

### 1. InfoRow Component
**File:** `apps/wc-booking/src/components/account/info-row.tsx`

```typescript
interface InfoRowProps {
  label: string
  value: string | React.ReactNode
  hint?: string
  onEdit?: () => void
  badge?: React.ReactNode
}
```

**Styling:**
- Hover background effect
- Underlined "Edit" button
- Label in uppercase, small font
- Value in larger, medium weight font

### 2. SettingRow Component
**File:** `apps/wc-booking/src/components/account/setting-row.tsx`

```typescript
interface SettingRowProps {
  label: string
  value?: string
  description?: string
  badge?: React.ReactNode
  action?: React.ReactNode
}
```

**Styling:**
- Border-bottom separator
- Flex layout with space-between
- Optional badge display
- Optional action button/link

### 3. VerificationBadge Component
**File:** `apps/wc-booking/src/components/account/verification-badge.tsx`

```typescript
interface VerificationBadgeProps {
  verified: boolean
}
```

**Styling:**
- Green background when verified
- Checkmark icon
- "Verified" text
- Rounded pill shape

---

## API Integration Summary

### Existing Endpoints (Already Working)
- GET `/user/auth/profile` - Get user profile
- PATCH `/user/auth/profile` - Update profile fields

### New Endpoints Required

#### Profile Updates
- PATCH `/user/auth/profile` - Extend to support:
  - `primaryNationality`
  - `secondaryNationality`
  - `languages`
  - `profilePhotoUrl`

#### Email Management
- POST `/user/auth/email/change-request` - Request email change (contact email)
- POST `/user/auth/email/verify` - Verify email change with token
- POST `/user/auth/login-email/change-request` - Request login email change (requires password)
- POST `/user/auth/login-email/verify` - Verify login email change

#### Phone Management
- POST `/user/auth/phone/change-request` - Request phone change
- POST `/user/auth/phone/verify` - Verify phone with SMS code

#### File Upload
- POST `/user/auth/profile/photo` - Upload profile photo
- DELETE `/user/auth/profile/photo` - Remove profile photo

---

## Styling Guidelines

### Follow Security Settings Pattern

**Reference:** `apps/wc-booking/src/app/(dashboard)/account/settings/security/page.tsx`

**Key Patterns:**
1. **Page Header:**
   ```tsx
   <div className="mb-10">
     <h1 className="text-[32px] font-semibold text-gray-900 dark:text-gray-100 mb-2">
       {title}
     </h1>
     <p className="text-base text-gray-500 dark:text-gray-400">
       {subtitle}
     </p>
   </div>
   ```

2. **Section Header:**
   ```tsx
   <div className="mb-5">
     <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
       {sectionTitle}
     </h2>
     <p className="text-sm text-gray-500 dark:text-gray-400">
       {sectionDescription}
     </p>
   </div>
   ```

3. **Setting Row:**
   ```tsx
   <div className="flex items-center justify-between gap-4 py-5 pr-4 border-b border-gray-200 dark:border-gray-700">
     <div className="flex-1 min-w-0">
       <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100 mb-1">
         {label}
       </div>
       <div className="text-sm text-gray-500 dark:text-gray-400">
         {description}
       </div>
     </div>
     <div className="shrink-0">
       {action}
     </div>
   </div>
   ```

4. **Modal Structure:**
   ```tsx
   <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center">
     <ModalContent>
       <ModalHeader className="text-xl font-semibold">{title}</ModalHeader>
       <ModalBody className="gap-5">
         {/* Form fields */}
       </ModalBody>
       <ModalFooter>
         <Button variant="light" onPress={onClose}>Cancel</Button>
         <Button color="secondary" onPress={onSave}>Save</Button>
       </ModalFooter>
     </ModalContent>
   </Modal>
   ```

5. **Toast Notifications:**
   ```tsx
   import { addToast } from '@heroui/react'

   addToast({
     title: 'Success',
     description: 'Changes saved successfully',
     color: 'success',
   })
   ```

### HeroUI v2.8.7 Components to Use

- `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`
- `Button` (variants: `light`, `solid`, colors: `primary`, `secondary`, `danger`)
- `Input` from `@world-schools/ui-web`
- `Switch` (for toggles)
- `Progress` (for password strength)
- `addToast` (for notifications)

### Tailwind CSS v4 Utilities

- Spacing: `mb-10`, `gap-4`, `py-5`, `px-4`
- Typography: `text-[32px]`, `font-semibold`, `text-gray-900`
- Layout: `flex`, `items-center`, `justify-between`
- Borders: `border-b`, `border-gray-200`
- Dark mode: `dark:bg-gray-900`, `dark:text-gray-100`

---

## Implementation Order

### Week 1: Personal Info Page
1. Create shared components (InfoRow, VerificationBadge)
2. Create ProfilePhotoSection component
3. Create modal components (LegalName, Nationality, Languages)
4. Update Personal Info page layout
5. Update profile service
6. Test and refine

### Week 2: Contact Details Page
1. Create SettingRow component
2. Create contact modal components (Email, Phone, Address)
3. Create contact services
4. Implement Contact Details page
5. Backend: Email/Phone verification endpoints
6. Test verification flows

### Week 3: Account Settings Page
1. Create ChangeLoginEmailModal component
2. Implement Account Settings page
3. Backend: Login email change endpoint
4. Test security (password verification)
5. Integration testing across all three pages

---

## Verification Checklist

### Personal Info Page
- [ ] Profile photo upload/remove works
- [ ] Legal name modal saves correctly
- [ ] Nationality modal supports primary + secondary
- [ ] Languages modal checkbox list works
- [ ] Toast notifications appear on save
- [ ] Loading states display correctly
- [ ] Error handling works
- [ ] Dark mode styling correct
- [ ] Mobile responsive

### Contact Details Page
- [ ] Email verification badge displays
- [ ] Email change sends verification email
- [ ] Phone verification badge displays
- [ ] Phone change sends SMS code
- [ ] Address modal saves all fields
- [ ] Helper text displays under each field
- [ ] Toast notifications work
- [ ] Loading states work
- [ ] Error handling works
- [ ] Dark mode styling correct
- [ ] Mobile responsive

### Account Settings Page
- [ ] Login email displays with verified badge
- [ ] Change email modal requires password
- [ ] Account created date displays correctly
- [ ] Account type displays correctly
- [ ] Email verification flow works
- [ ] Toast notifications work
- [ ] Error handling works
- [ ] Dark mode styling correct
- [ ] Mobile responsive

### Cross-Page Integration
- [ ] All pages use consistent styling
- [ ] All modals follow same pattern
- [ ] Toast notifications consistent
- [ ] Loading states consistent
- [ ] Error messages consistent
- [ ] Navigation between pages works
- [ ] Data updates reflect across pages
- [ ] API integration complete
- [ ] TypeScript types correct
- [ ] No console errors

---

## Notes

1. **HeroUI Version:** This implementation uses HeroUI v2.8.7, NOT v3. Do not use v3 components or patterns.

2. **Modal Pattern:** All forms use modals (not inline forms). Follow the Security Settings page pattern exactly.

3. **Toast Notifications:** Use `addToast` from `@heroui/react` for all success/error messages.

4. **API Client:** Use the existing `apiClient` from `@/utils/api-client` for all API calls.

5. **Type Safety:** Ensure all TypeScript types are properly defined in `@world-schools/wc-types` package.

6. **Backend Coordination:** Backend team needs to implement new endpoints before frontend testing can be completed.

7. **Verification Flows:** Email and phone verification require multi-step flows (request → verify). Plan for this complexity.

8. **Security:** Login email changes require password confirmation for security.

9. **Testing:** Test all flows in both light and dark modes, and on mobile devices.

10. **Accessibility:** Ensure all modals are keyboard-navigable and screen-reader friendly.


