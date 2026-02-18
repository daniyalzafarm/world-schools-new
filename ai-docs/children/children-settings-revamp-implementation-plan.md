# 📋 Children Settings Pages Revamp - Implementation Plan

**Version:** 1.0
**Last Updated:** 2026-02-16
**Status:** Ready for Implementation

---

## 📑 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [New Data Model Specification](#-new-data-model-specification)
3. [Implementation Phases](#-implementation-phases)
4. [Data Migration Considerations](#-data-migration-considerations)
5. [Validation & Business Rules](#-validation--business-rules)
6. [UI/UX Considerations](#-uiux-considerations)
7. [File Structure Summary](#-file-structure-summary)
8. [Risks & Mitigation](#-risks--mitigation)
9. [Success Metrics](#-success-metrics)
10. [Deployment Plan](#-deployment-plan)
11. [Documentation Requirements](#-documentation-requirements)
12. [Future Enhancements](#-future-enhancements)

---

## 🎯 Executive Summary

### Project Overview

This plan outlines the complete restructuring of the child profile management system to align with the new design specifications. The current implementation uses a single accordion-based form for all child data, while the new design requires:

1. A simplified child creation modal (4 fields only)
2. Separate dedicated pages for each profile section
3. A new data model aligned with camp booking requirements
4. Profile completion tracking and booking eligibility validation

### Design Reference

- **Primary Reference:** `booking-design/Parents/children/README.md`
- **HTML References:** All files in `booking-design/Parents/children/` folder

### Key Objectives

- ✅ Simplify child creation to essential fields only
- ✅ Create dedicated pages for Profile Info, Medical & Safety, Emergency Contacts, and Camp Preferences
- ✅ Implement weighted profile completion calculation
- ✅ Add booking eligibility validation (≥75% completion required)
- ✅ Migrate from school-focused to camp-focused data model

---

## 🔍 Gap Analysis

### Current State vs. Design Requirements

| Aspect | Current Implementation | Design Requirement | Gap |
|--------|----------------------|-------------------|-----|
| **Data Model** | School-focused (academic preferences, learning styles, boarding interest) | Camp-focused (medical info, emergency contacts, camp preferences, swimming ability) | **Complete restructure needed** |
| **Child Creation** | Full accordion form with all sections | Simple modal: First name, Last name (optional), DOB, Gender | **Simplification required** |
| **Profile Editing** | Single page with accordion sections | Separate pages per section (Profile, Medical, Emergency, Preferences) | **Page structure change** |
| **Emergency Contacts** | Not implemented | Per-child contacts (min 1, max 3) with detailed fields | **New feature** |
| **Medical Info** | Basic special needs only | Comprehensive: allergies, dietary, medications, conditions, swimming, doctor, insurance | **Expansion needed** |
| **Profile Completion** | Basic progress tracking | Weighted calculation (Basic 30%, Medical 20%, Emergency 25%, Preferences 15%, Photo 10%) | **Algorithm update** |
| **Validation** | First name + last name required | First name + DOB + gender required for creation; profile ≥75% for booking | **Rule changes** |

---

## 📊 New Data Model Specification

### Core Interfaces

#### Emergency Contact Interface

```typescript
export interface EmergencyContact {
  id: string
  name: string
  relationship: string // 'Parent' | 'Guardian' | 'Grandparent' | 'Sibling' | 'Other'
  primaryPhone: string
  secondaryPhone?: string
  email?: string
  authorizedForPickup: boolean
  notes?: string
}
```

#### Medical Information Interface

```typescript
export interface MedicalInfo {
  allergies: string[] // Multi-select from predefined list + custom
  dietaryRequirements: string[] // Multi-select from predefined list + custom
  medications?: string
  medicalConditions?: string
  specialNeeds?: string
  swimmingAbility?: 'cannot_swim' | 'beginner' | 'intermediate' | 'advanced' | 'competitive'
  doctorName?: string
  doctorPhone?: string
  insuranceInfo?: string
}
```

#### Camp Preferences Interface

```typescript
export interface CampPreferences {
  interests: string[] // Sports, Arts, Adventure, STEM, Nature, Languages
  preferredCampTypes: string[] // Day camp, Overnight, Residential, etc.
  locationPreferences?: {
    maxDistance?: number // in km
    preferredAreas?: string[]
  }
  budgetRange?: {
    min?: number
    max?: number
    currency: string
  }
  preferredDuration?: string[] // '1-3 days', '4-7 days', '1-2 weeks', '2+ weeks'
  languagesSpoken: string[]
  previousCampExperience?: string
}
```

#### Updated Child Interface

```typescript
export interface Child {
  id: string
  parentId: string

  // Basic info (30% weight)
  firstName: string
  lastName?: string
  nickname?: string
  dateOfBirth: Date | string
  gender: 'boy' | 'girl' | 'non_binary' | 'prefer_not_to_say'
  photoUrl?: string
  schoolYear?: string

  // Medical (20% weight)
  medicalInfo: MedicalInfo

  // Emergency contacts (25% weight)
  emergencyContacts: EmergencyContact[]

  // Preferences (15% weight)
  campPreferences: CampPreferences

  // Meta
  profileCompletion: number // 0-100
  createdAt: Date | string
  updatedAt: Date | string
  archived: boolean
}
```

### Constants and Enums

#### Allergy Options

```typescript
export const ALLERGY_OPTIONS = [
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Eggs',
  'Gluten',
  'Shellfish',
  'Fish',
  'Soy',
  'Sesame',
  'Bee stings',
  'Other'
] as const
```

#### Dietary Requirement Options

```typescript
export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'Kosher',
  'Gluten-free',
  'Dairy-free',
  'Other'
] as const
```

#### Swimming Ability Levels

```typescript
export const SWIMMING_LEVELS = [
  { value: 'cannot_swim', label: 'Cannot swim' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'competitive', label: 'Competitive' }
] as const
```

#### Relationship Options

```typescript
export const RELATIONSHIP_OPTIONS = [
  'Parent',
  'Guardian',
  'Grandparent',
  'Aunt/Uncle',
  'Sibling',
  'Family Friend',
  'Other'
] as const
```

#### Interest Categories

```typescript
export const INTEREST_CATEGORIES = {
  sports: ['Football', 'Basketball', 'Tennis', 'Swimming', 'Volleyball', 'Athletics'],
  arts: ['Painting', 'Music', 'Drama', 'Dance', 'Photography', 'Crafts'],
  adventure: ['Climbing', 'Hiking', 'Camping', 'Kayaking', 'Archery', 'Survival Skills'],
  stem: ['Coding', 'Robotics', 'Science', 'Engineering', 'Mathematics', 'Technology'],
  nature: ['Animals', 'Environment', 'Farming', 'Gardening', 'Wildlife', 'Conservation'],
  languages: ['Spanish', 'French', 'German', 'Mandarin', 'Arabic', 'Other']
} as const
```

### Helper Functions

```typescript
/**
 * Get child's display name
 */
export function getChildDisplayName(child: Child): string {
  if (child.nickname) return child.nickname
  if (child.lastName) return `${child.firstName} ${child.lastName}`
  return child.firstName
}

/**
 * Calculate child's age from date of birth
 */
export function getChildAge(dateOfBirth: Date | string): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/**
 * Check if child is eligible for booking
 */
export function isBookingEligible(child: Child): boolean {
  return child.profileCompletion >= 75 && child.emergencyContacts.length >= 1
}
```

---

## 🎯 Implementation Phases

### Phase 1: Backend Schema & API Updates

**Complexity:** Moderate
**Dependencies:** None
**Estimated Effort:** 2-3 days

#### 1.1 Database Schema Migration

**Files to Modify:**
- `world-schools/apps/wc-nest-api/src/modules/user/children/entities/child.entity.ts`

**Changes Required:**

```typescript
// Add new columns to Child entity
@Column({ type: 'jsonb', nullable: true })
medicalInfo: MedicalInfo

@Column({ type: 'jsonb', default: [] })
emergencyContacts: EmergencyContact[]

@Column({ type: 'jsonb', nullable: true })
campPreferences: CampPreferences

@Column({ nullable: true })
nickname: string

@Column({ nullable: true })
photoUrl: string

@Column({ nullable: true })
schoolYear: string

@Column({ type: 'int', default: 0 })
profileCompletion: number

@Column({ default: false })
archived: boolean

// Remove old school-focused fields
// - academicPreferences
// - extraCurricular
// - specialNeeds (move to medicalInfo.specialNeeds)
```

**Migration Strategy:**

1. Create migration file to add new columns
2. Create data migration script to transform existing records:
   - Map `specialNeeds.additionalNotes` → `medicalInfo.specialNeeds`
   - Map `extraCurricular.interests` → `campPreferences.interests`
   - Set `emergencyContacts` to empty array (parents will need to add)
   - Calculate initial `profileCompletion` based on existing data
3. After migration, remove old columns in a separate migration

#### 1.2 Update DTOs

**Files to Modify:**
- `world-schools/apps/wc-nest-api/src/modules/user/children/dto/create-child.dto.ts`
- `world-schools/apps/wc-nest-api/src/modules/user/children/dto/update-child.dto.ts`

**New DTOs to Create:**
- `world-schools/apps/wc-nest-api/src/modules/user/children/dto/medical-info.dto.ts`
- `world-schools/apps/wc-nest-api/src/modules/user/children/dto/emergency-contact.dto.ts`
- `world-schools/apps/wc-nest-api/src/modules/user/children/dto/camp-preferences.dto.ts`

**create-child.dto.ts Changes:**

```typescript
export class CreateChildDto {
  @ApiProperty({ description: 'First name', example: 'Emma' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  firstName: string

  @ApiProperty({ description: 'Last name', example: 'Smith', required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string

  @ApiProperty({ description: 'Date of birth', example: '2015-05-15' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string

  @ApiProperty({ description: 'Gender', example: 'girl' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['boy', 'girl', 'non_binary', 'prefer_not_to_say'])
  gender: string

  // All other fields are optional and added later via update
}
```

**update-child.dto.ts Changes:**

```typescript
export class UpdateChildDto {
  // Basic info
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  firstName?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(2, 50)
  lastName?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Length(2, 30)
  nickname?: string

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  gender?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  schoolYear?: string

  // Medical info
  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => MedicalInfoDto)
  @IsOptional()
  medicalInfo?: MedicalInfoDto

  // Emergency contacts
  @ApiProperty({ required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContacts?: EmergencyContactDto[]

  // Camp preferences
  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => CampPreferencesDto)
  @IsOptional()
  campPreferences?: CampPreferencesDto
}
```


#### 1.3 Update Service Logic

**Files to Modify:**
- `world-schools/apps/wc-nest-api/src/modules/user/children/children.service.ts`

**Changes Required:**

1. Update `create()` method to only require minimal fields
2. Add `calculateProfileCompletion()` helper method
3. Update `update()` method to recalculate profile completion on each update
4. Add validation for emergency contacts (min 1 for booking eligibility)
5. Add `archive()` method for soft delete

**Profile Completion Calculation:**

```typescript
private calculateProfileCompletion(child: Child): number {
  let score = 0

  // Basic info (30%)
  if (child.firstName && child.dateOfBirth && child.gender) {
    score += 30
  }

  // Medical info (20%)
  const hasMedicalInfo = child.medicalInfo && (
    child.medicalInfo.allergies?.length > 0 ||
    child.medicalInfo.dietaryRequirements?.length > 0 ||
    child.medicalInfo.medications ||
    child.medicalInfo.medicalConditions ||
    child.medicalInfo.specialNeeds ||
    child.medicalInfo.swimmingAbility
  )
  if (hasMedicalInfo) {
    score += 20
  }

  // Emergency contacts (25%)
  if (child.emergencyContacts?.length >= 1) {
    score += 25
  }

  // Preferences (15%)
  if (child.campPreferences?.interests?.length > 0) {
    score += 15
  }

  // Photo (10%)
  if (child.photoUrl) {
    score += 10
  }

  return score
}
```

#### 1.4 API Endpoint Strategy

**Decision:** Continue using single `PATCH /children/:id` endpoint with partial updates

**Rationale:**
- Simpler API surface
- Frontend can update any section independently
- Consistent with RESTful principles
- Profile completion recalculated on every update

**Alternative (Not Recommended):** Separate endpoints per section would add complexity without significant benefit.

---

### Phase 2: Frontend Type Updates

**Complexity:** Simple
**Dependencies:** Phase 1 complete
**Estimated Effort:** 1 day

#### 2.1 Update Type Definitions

**Files to Modify:**
- `world-schools/apps/wc-booking/src/types/child.ts`

**Changes:**

1. Replace current interfaces with new data model (see Data Model Specification section)
2. Add new constants (ALLERGY_OPTIONS, DIETARY_OPTIONS, SWIMMING_LEVELS, RELATIONSHIP_OPTIONS, INTEREST_CATEGORIES)
3. Update helper functions:
   - `createEmptyChild()` - return new structure
   - `calculateSectionProgress()` - remove, replaced by backend calculation
   - `getChildDisplayName()` - update to handle optional lastName
   - `getChildAge()` - keep as-is
   - Add `isBookingEligible()` - check profileCompletion >= 75 && emergencyContacts.length >= 1

#### 2.2 Update Store

**Files to Modify:**
- `world-schools/apps/wc-booking/src/stores/children-store.ts`

**Changes:**

1. Remove progress calculation methods (now handled by backend)
2. Update `addChild()` to only accept minimal fields (firstName, lastName?, dateOfBirth, gender)
3. Update `updateChild()` to accept partial updates for any section
4. Add `archiveChild()` method
5. Add `getBookingEligibleChildren()` helper (profileCompletion >= 75)

---

### Phase 3: Child Creation Modal (Simplified)

**Complexity:** Simple
**Dependencies:** Phase 2 complete
**Estimated Effort:** 1 day

#### 3.1 Create Modal Component

**File to Create:**
- `world-schools/apps/wc-booking/src/components/modals/add-child-modal.tsx`

**Component Structure:**

```typescript
interface AddChildModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (childId: string) => void
}

export function AddChildModal({ isOpen, onClose, onSuccess }: AddChildModalProps) {
  // Form state for 4 fields only:
  // - firstName (required)
  // - lastName (optional)
  // - dateOfBirth (required)
  // - gender (required)

  // Validation:
  // - firstName: 2-50 chars
  // - lastName: 2-50 chars if provided
  // - dateOfBirth: valid date, child must be 3-18 years old
  // - gender: one of the 4 options

  // On submit:
  // 1. Call addChild() from store
  // 2. On success, redirect to /children/[id]/profile with toast message
  //    "Profile created! Complete the remaining sections to enable booking."
  // 3. On error, show error message
}
```

**UI Components to Use:**
- `Modal` from `@heroui/react`
- `Input` from `@world-schools/ui-web`
- `DatePicker` from `@world-schools/ui-web`
- `RadioGroup` from `@heroui/react` for gender selection
- `Button` from `@heroui/react`

**Design Reference:**
- `booking-design/Parents/children/children-list.html` (lines 852-896)

#### 3.2 Update Children List Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/page.tsx`

**Changes:**

1. Remove link to `/children/new` route (if exists)
2. Add "Add a child" button that opens `AddChildModal`
3. Update child cards to show profile completion percentage
4. Add visual indicator for children with profileCompletion < 75% (warning badge)

---

### Phase 4: Profile Settings Pages

**Complexity:** Moderate to Complex
**Dependencies:** Phase 3 complete
**Estimated Effort:** 5-7 days (1-2 days per page)

#### 4.1 Profile Info Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/[id]/profile/page.tsx`

**Form Fields:**
- First name (required, 2-50 chars)
- Last name (optional, 2-50 chars)
- Nickname (optional, 2-30 chars)
- Date of birth (required, valid date)
- Gender (required, radio group)
- Photo upload (optional, JPG/PNG, max 5MB)
- School year (optional, dropdown based on age)

**Features:**
- Auto-save on blur or manual save button
- Validation feedback inline
- Photo upload with preview
- Age calculation display
- Profile completion indicator at top

**Design Reference:**
- `booking-design/Parents/children/child-profile-info.html`

**Components to Use:**
- `Input` from `@world-schools/ui-web`
- `DatePicker` from `@world-schools/ui-web`
- `RadioGroup` from `@heroui/react`
- `SelectField` from `@world-schools/ui-web`
- `FileUpload` component (may need to create)
- `Button` from `@heroui/react`

#### 4.2 Medical & Safety Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/[id]/medical/page.tsx`

**Form Fields:**
- Allergies (multi-select chips + custom input)
- Dietary requirements (multi-select chips + custom input)
- Medications (textarea)
- Medical conditions (textarea)
- Special needs (textarea)
- Swimming ability (dropdown)
- Doctor name (text input)
- Doctor phone (phone input with validation)
- Insurance info (textarea)

**Features:**
- Multi-select chip interface for allergies/dietary
- "Add custom" option for allergies/dietary
- Character count for textareas
- Privacy notice display
- Save button with loading state

**Design Reference:**
- `booking-design/Parents/children/child-medical-safety.html`

**Components to Use:**
- `ChipButton` from `@world-schools/ui-web`
- `Textarea` from `@world-schools/ui-web`
- `SelectField` from `@world-schools/ui-web`
- `Input` from `@world-schools/ui-web`
- `Alert` from `@heroui/react` for privacy notice

#### 4.3 Emergency Contacts Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/[id]/emergency/page.tsx`

**Form Structure:**
- List of existing contacts (0-3)
- "Add contact" button (disabled if 3 contacts exist)
- Each contact card shows:
  - Name, relationship, primary phone
  - Edit/Delete buttons
- Contact form (inline or modal):
  - Name (required)
  - Relationship (required, dropdown)
  - Primary phone (required, phone validation)
  - Secondary phone (optional, phone validation)
  - Email (optional, email validation)
  - Authorized for pickup (checkbox, default true)
  - Notes (optional, textarea)

**Features:**
- Minimum 1 contact required (show warning if 0)
- Maximum 3 contacts (disable add button)
- Inline editing or modal editing
- Delete confirmation dialog
- Reorder contacts (drag and drop - optional)
- Warning banner if < 1 contact: "At least 1 emergency contact is required for booking"

**Design Reference:**
- `booking-design/Parents/children/child-emergency-contacts.html`

**Components to Use:**
- `Card` from `@heroui/react`
- `Input` from `@world-schools/ui-web`
- `SelectField` from `@world-schools/ui-web`
- `Checkbox` from `@heroui/react`
- `Textarea` from `@world-schools/ui-web`
- `Button` from `@heroui/react`
- `AlertDialog` from `@heroui/react` for delete confirmation

#### 4.4 Camp Preferences Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/[id]/preferences/page.tsx`

**Form Fields:**
- Interests (multi-select chips by category)
  - Sports, Arts, Adventure, STEM, Nature, Languages
  - Expandable categories with "Show more" buttons
- Preferred camp types (checkboxes)
  - Day camp, Overnight, Residential, etc.
- Location preferences
  - Max distance (slider, km)
  - Preferred areas (multi-select)
- Budget range (dual slider, currency selector)
- Preferred duration (checkboxes)
  - 1-3 days, 4-7 days, 1-2 weeks, 2+ weeks
- Languages spoken (multi-select)
- Previous camp experience (textarea)

**Features:**
- Categorized interest selection
- Show more/less for interest categories
- Dual-handle slider for budget range
- Currency selector (USD, EUR, GBP, etc.)
- Save button with loading state

**Design Reference:**
- `booking-design/Parents/children/child-camp-preferences.html`

**Components to Use:**
- `ChipButton` from `@world-schools/ui-web`
- `ShowMoreButton` from `@world-schools/ui-web`
- `Slider` from `@heroui/react`
- `Checkbox` from `@heroui/react`
- `SelectField` from `@world-schools/ui-web`
- `Textarea` from `@world-schools/ui-web`

---

### Phase 5: Integration & Polish

**Complexity:** Moderate
**Dependencies:** Phase 4 complete
**Estimated Effort:** 2-3 days

#### 5.1 Update Child Profile Overview Page

**File to Modify:**
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/[id]/page.tsx`

**Changes:**

1. Update profile completion calculation to use backend value
2. Update Quick Access section to reflect new page structure (already done)
3. Add profile completion prompts:
   - If < 75%: "Complete your profile to enable booking" banner
   - If no emergency contacts: "Add emergency contact" warning
   - If no medical info: "Add medical information" prompt
4. Update stats display (if applicable)

#### 5.2 Form State Management Strategy

**Approach:** Use React Hook Form with Zod validation

**Rationale:**
- Consistent with existing patterns in codebase
- Built-in validation
- Easy integration with HeroUI components
- Type-safe with Zod schemas

**Example Schema:**

```typescript
import { z } from 'zod'

const profileInfoSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50).optional(),
  nickname: z.string().min(2).max(30).optional(),
  dateOfBirth: z.string().refine(isValidDate),
  gender: z.enum(['boy', 'girl', 'non_binary', 'prefer_not_to_say']),
  photoUrl: z.string().url().optional(),
  schoolYear: z.string().optional()
})
```

#### 5.3 Unsaved Changes Warning

**Implementation:**
- Use `useBeforeUnload` hook to warn on page navigation
- Show confirmation dialog if form is dirty
- Exclude from warning if auto-save is enabled

#### 5.4 Remove Old Child Form

**Files to Remove:**
- `world-schools/apps/wc-booking/src/components/forms/child-form.tsx`
- `world-schools/apps/wc-booking/src/app/(dashboard)/children/new/page.tsx` (if exists)

**Files to Update:**
- Remove any imports/references to old child form

---

## 🔄 Data Migration Considerations

### Existing Child Records

**Challenge:** Existing children have school-focused data structure

**Migration Strategy:**

#### 1. Automatic Field Mapping

```typescript
// Backend migration script
const migrateChild = (oldChild) => ({
  ...oldChild,
  // Map old fields to new structure
  medicalInfo: {
    specialNeeds: oldChild.specialNeeds?.additionalNotes,
    allergies: [],
    dietaryRequirements: [],
    // ... other fields default to null
  },
  campPreferences: {
    interests: oldChild.extraCurricular?.interests || [],
    languagesSpoken: oldChild.personalInfo?.languages || ['English'],
    // ... other fields default to null
  },
  emergencyContacts: [], // Empty, parents must add
  profileCompletion: calculateInitialCompletion(oldChild),
  archived: false
})
```

#### 2. Profile Completion Recalculation

- Run migration to calculate initial profileCompletion for all existing children
- Most will be < 75% due to missing emergency contacts and medical info

#### 3. User Communication

- Show banner on children list: "We've updated child profiles! Please review and complete the new sections."
- Email notification to parents about profile updates
- In-app notification with link to children list

#### 4. Gradual Rollout

- **Phase 1:** Deploy backend changes with migration
- **Phase 2:** Deploy frontend changes (new pages still work with old data)
- **Phase 3:** Encourage users to complete new sections
- **Phase 4:** After 30 days, enforce booking eligibility rules

---

## ✅ Validation & Business Rules

### Child Creation Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| First name | Required, 2-50 chars | "First name must be between 2 and 50 characters" |
| Last name | Optional, 2-50 chars if provided | "Last name must be between 2 and 50 characters" |
| Date of birth | Required, valid date, age 3-18 | "Child must be between 3 and 18 years old" |
| Gender | Required, one of 4 options | "Please select a gender" |


### Profile Completion Calculation

```typescript
function calculateProfileCompletion(child: Child): number {
  let score = 0

  // Basic info (30%)
  if (child.firstName && child.dateOfBirth && child.gender) {
    score += 30
  }

  // Medical info (20%)
  const hasMedicalInfo = child.medicalInfo && (
    child.medicalInfo.allergies?.length > 0 ||
    child.medicalInfo.dietaryRequirements?.length > 0 ||
    child.medicalInfo.medications ||
    child.medicalInfo.medicalConditions ||
    child.medicalInfo.specialNeeds ||
    child.medicalInfo.swimmingAbility
  )
  if (hasMedicalInfo) {
    score += 20
  }

  // Emergency contacts (25%)
  if (child.emergencyContacts?.length >= 1) {
    score += 25
  }

  // Preferences (15%)
  if (child.campPreferences?.interests?.length > 0) {
    score += 15
  }

  // Photo (10%)
  if (child.photoUrl) {
    score += 10
  }

  return score
}
```

### Booking Eligibility Rules

1. **Profile Completion:** Must be ≥ 75%
2. **Emergency Contacts:** Must have at least 1
3. **Age:** Must be within camp's age range (checked at booking time)

**Enforcement:**
- Show warning on child card if < 75%
- Disable "Book" button in booking flow if child not eligible
- Show modal explaining requirements if user tries to book with ineligible child

---

## 🎨 UI/UX Considerations

### Form Patterns

#### 1. Auto-save vs. Manual Save

**Recommendation:** Manual save with "Save" button

**Rationale:**
- Gives users control
- Clear feedback
- Prevents accidental changes

**Implementation:**
- Show "Unsaved changes" indicator
- Enable save button when form is dirty

#### 2. Validation Feedback

- Inline validation on blur
- Error messages below fields
- Success toast on save
- Error toast on save failure

#### 3. Loading States

- Skeleton loaders for initial page load
- Spinner on save button during save
- Disabled form fields during save

### Mobile Responsiveness

- All forms must be mobile-friendly
- Stack form fields vertically on mobile
- Use mobile-optimized date picker
- Ensure touch targets are ≥ 44px
- Test on iOS and Android

### Accessibility

- All form fields must have labels
- Use semantic HTML
- Keyboard navigation support
- Screen reader announcements for errors
- ARIA labels for icon buttons
- Focus management in modals

---

## 📦 File Structure Summary

### New Files to Create

```
world-schools/apps/wc-booking/src/
├── components/
│   └── modals/
│       └── add-child-modal.tsx (NEW)
```

### Files to Modify

**Frontend:**

```
world-schools/apps/wc-booking/src/
├── types/
│   └── child.ts (UPDATE - new data model)
├── stores/
│   └── children-store.ts (UPDATE - remove progress methods)
├── app/(dashboard)/
│   ├── children/
│   │   └── page.tsx (UPDATE - add modal, update cards)
│   └── children/[id]/
│       ├── page.tsx (UPDATE - profile completion, prompts)
│       ├── profile/
│       │   └── page.tsx (UPDATE - replace placeholder)
│       ├── medical/
│       │   └── page.tsx (UPDATE - replace placeholder)
│       ├── emergency/
│       │   └── page.tsx (UPDATE - replace placeholder)
│       └── preferences/
│           └── page.tsx (UPDATE - replace placeholder)
```

**Backend:**

```
world-schools/apps/wc-nest-api/src/modules/user/children/
├── entities/
│   └── child.entity.ts (UPDATE - new schema)
├── dto/
│   ├── create-child.dto.ts (UPDATE - minimal fields)
│   ├── update-child.dto.ts (UPDATE - all optional)
│   ├── medical-info.dto.ts (NEW)
│   ├── emergency-contact.dto.ts (NEW)
│   └── camp-preferences.dto.ts (NEW)
└── children.service.ts (UPDATE - profile completion logic)
```

### Files to Remove

```
world-schools/apps/wc-booking/src/
├── components/forms/
│   └── child-form.tsx (DELETE)
└── app/(dashboard)/children/
    └── new/
        └── page.tsx (DELETE if exists)
```

---

## ⚠️ Risks & Mitigation

### Risk 1: Data Loss During Migration

**Impact:** High
**Probability:** Low

**Mitigation:**
- Backup database before migration
- Test migration on staging environment
- Keep old fields for 30 days before dropping
- Provide rollback script

### Risk 2: Breaking Changes for Existing Users

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Gradual rollout (backend first, frontend second)
- Clear communication about changes
- Grace period before enforcing booking eligibility
- Support team prepared for questions

### Risk 3: Complex Emergency Contacts UI

**Impact:** Low
**Probability:** Medium

**Mitigation:**
- Start with simple inline form
- Add advanced features (drag-and-drop) in later iteration
- User testing before full rollout

### Risk 4: Photo Upload Implementation

**Impact:** Medium
**Probability:** Low

**Mitigation:**
- Use existing file upload service if available
- Otherwise, implement simple S3/Cloudinary integration
- Add file size/type validation
- Provide clear error messages

---

## 📈 Success Metrics

### Technical Metrics

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests covering critical paths
- [ ] No TypeScript errors
- [ ] No console errors in production
- [ ] Lighthouse score ≥ 90 for all pages

### User Metrics

- [ ] Profile completion rate increases by 30%
- [ ] Average time to create child < 2 minutes
- [ ] Average time to complete profile < 10 minutes
- [ ] Booking eligibility rate ≥ 80% within 30 days
- [ ] User satisfaction score ≥ 4.5/5

### Business Metrics

- [ ] Booking conversion rate increases
- [ ] Support tickets related to child profiles decrease by 50%
- [ ] Data quality improves (fewer missing fields)

---

## 🚀 Deployment Plan

### Week 1: Backend Foundation

- **Day 1-2:** Database migration + DTOs
  - [ ] Create migration files
  - [ ] Create new DTO files
  - [ ] Update entity definitions
- **Day 3:** Service logic + profile completion
  - [ ] Implement `calculateProfileCompletion()`
  - [ ] Update create/update methods
  - [ ] Add archive method
- **Day 4:** Testing
  - [ ] Unit tests for service methods
  - [ ] Integration tests for API endpoints
- **Day 5:** Deploy to staging
  - [ ] Run migration on staging database
  - [ ] Verify API endpoints
  - [ ] Test with Postman/Insomnia

### Week 2: Frontend Foundation & Child Creation

- **Day 1:** Update types
  - [ ] Update `child.ts` with new interfaces
  - [ ] Add constants
  - [ ] Update helper functions
- **Day 2:** Update store
  - [ ] Remove progress calculation methods
  - [ ] Update `addChild()` method
  - [ ] Update `updateChild()` method
  - [ ] Add `archiveChild()` method
- **Day 3:** Build child creation modal
  - [ ] Create `add-child-modal.tsx`
  - [ ] Implement form with validation
  - [ ] Add success/error handling
- **Day 4-5:** Integrate modal & deploy
  - [ ] Update children list page
  - [ ] Add profile completion indicators
  - [ ] Deploy to staging

### Week 3: Profile Settings Pages (Part 1)

- **Day 1-2:** Profile Info page
  - [ ] Build form layout
  - [ ] Implement photo upload
  - [ ] Add validation
  - [ ] Test on mobile
- **Day 3-4:** Medical & Safety page
  - [ ] Build multi-select chip interface
  - [ ] Implement all form fields
  - [ ] Add privacy notice
  - [ ] Test on mobile
- **Day 5:** Testing
  - [ ] Integration testing
  - [ ] Cross-browser testing
  - [ ] Accessibility testing

### Week 4: Profile Settings Pages (Part 2)

- **Day 1-2:** Emergency Contacts page
  - [ ] Build contact list UI
  - [ ] Implement add/edit/delete
  - [ ] Add validation (min 1, max 3)
  - [ ] Test on mobile
- **Day 3-4:** Camp Preferences page
  - [ ] Build categorized interests UI
  - [ ] Implement budget range slider
  - [ ] Add all form fields
  - [ ] Test on mobile
- **Day 5:** Testing
  - [ ] Integration testing
  - [ ] Cross-browser testing
  - [ ] Accessibility testing

### Week 5: Integration, Polish & Launch

- **Day 1-2:** Integration & cleanup
  - [ ] Update child profile overview page
  - [ ] Remove old child form
  - [ ] Add unsaved changes warning
  - [ ] Update navigation
- **Day 3:** E2E testing
  - [ ] Test complete user flows
  - [ ] Test edge cases
  - [ ] Performance testing
- **Day 4:** Bug fixes
  - [ ] Fix any issues found in testing
  - [ ] Final QA pass
- **Day 5:** Deploy to production
  - [ ] Run migration on production database
  - [ ] Deploy frontend changes
  - [ ] Monitor for errors
  - [ ] Send user communication

---

## 📚 Documentation Requirements

### Developer Documentation

- [ ] Update API documentation (Swagger)
- [ ] Update type documentation (TSDoc comments)
- [ ] Create migration guide for developers
- [ ] Update README with new data model
- [ ] Document profile completion algorithm
- [ ] Document booking eligibility rules

### User Documentation

- [ ] Create help article: "How to create a child profile"
- [ ] Create help article: "Understanding profile completion"
- [ ] Create help article: "Why emergency contacts are required"
- [ ] Update FAQ with new information
- [ ] Create video tutorial (optional)

---

## ✨ Future Enhancements

These features are not part of the initial implementation but could be added later:

1. **Bulk Import:** Import multiple children from CSV
2. **Profile Templates:** Save preferences as templates for siblings
3. **Medical Document Upload:** Attach medical certificates, insurance cards
4. **Emergency Contact Verification:** Send SMS/email verification
5. **Profile Sharing:** Share child profile with co-parents
6. **Profile History:** Track changes to child profile over time
7. **AI-Powered Recommendations:** Suggest camps based on preferences
8. **Profile Completion Gamification:** Badges, rewards for completing sections
9. **Multi-language Support:** Translate forms and labels
10. **Offline Mode:** Allow profile editing offline with sync

---

## 📞 Support & Questions

For questions or clarifications during implementation:

1. **Design Questions:** Refer to `booking-design/Parents/children/README.md`
2. **Technical Questions:** Review this implementation plan
3. **API Questions:** Check Swagger documentation
4. **UI/UX Questions:** Reference HTML design files in `booking-design/Parents/children/`

---

**Document Version:** 1.0
**Last Updated:** 2026-02-16
**Status:** Ready for Implementation
**Estimated Total Effort:** 5 weeks (1 developer full-time)

---

## 📝 Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial implementation plan created | AI Assistant |

---

**End of Document**