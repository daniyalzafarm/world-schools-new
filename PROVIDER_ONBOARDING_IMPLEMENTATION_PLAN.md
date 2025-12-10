# Provider Onboarding & Application Review - Implementation Plan

## Overview

This document outlines the complete implementation plan for the Provider onboarding feature and application review process across the World Camps monorepo. The feature enables camp providers to submit applications through a 5-step onboarding flow in the **wc-provider** app, while superadmins review and approve/reject applications in the **wc-superadmin** app.

**Reference Materials:** `/Users/daniyal/files/dev/ws-server-setup/WC-Booking/Provider/1_onboarding/`

---

## Table of Contents

1. [Database Schema Changes](#1-database-schema-changes)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Implementation - Provider App](#3-frontend-implementation---provider-app)
4. [Frontend Implementation - Superadmin App](#4-frontend-implementation---superadmin-app)
5. [Icon Package Recommendation](#5-icon-package-recommendation)
6. [Color Mapping](#6-color-mapping)
7. [Shared Component Strategy](#7-shared-component-strategy)
8. [Implementation Phases](#8-implementation-phases)

---

## 1. Database Schema Changes

### 1.1 Extend Provider Model

The existing `Provider` model needs expansion to support the onboarding flow. Add the following fields to `apps/wc-nest-api/prisma/schema.prisma`:

**Contact & Account (Step 2):**
- `contactFirstName`, `contactLastName`, `contactRole`
- `contactPhone`, `contactPhoneCountryCode`
- `phoneVerified`, `phoneVerifiedAt`
- `legalCompanyName` - Official registered business name
- `legalStreetAddress`, `legalAptSuite`, `legalCity`, `legalStateProvince`, `legalPostalCode`, `legalCountry`
- `yearFounded` - Integer
- Note: `email`, `emailVerified`, `emailVerifiedAt`, `passwordHash` already exist in User model (via ownerId relation)

**Approval Status:**
- `trustScore` - Integer (0-100)
- `trustScoreBreakdown` - JSONB
- `approvalStatus` - Enum: 'pending' | 'under_review' | 'info_requested' | 'approved' | 'rejected' | 'suspended'
- `approvalDecisionAt` - DateTime
- `approvedByAdminId` - String (FK to User)
- `rejectionReason` - Text
- `rejectionCategory` - String

**Onboarding Progress:**
- `onboardingStartedAt`, `onboardingCompletedAt`
- `onboardingCurrentStep` - Integer (1-5)
- `lastLoginAt`

**Relations:**
- `googleBusinessProfile` - One-to-one relation to GoogleBusinessProfile
- `settings` - One-to-one relation to ProviderSettings
- `verificationDocuments` - One-to-many relation to VerificationDocument
- `conversations` - One-to-many relation to ProviderConversation (for future use)

**Out of Scope (Separate Epics):**
- Camp-related fields (description, campType, minAge, maxAge) - Will be implemented in Camp/Session Management epic
- Stripe Connect fields (stripeAccountId, stripeAccountStatus, stripePayoutsEnabled, stripeChargesEnabled, stripeOnboardingCompletedAt) - Will be implemented in Stripe Integration epic

### 1.2 New Models

**GoogleBusinessProfile:**
```prisma
model GoogleBusinessProfile {
  id                    String   @id @default(uuid())
  providerId            String   @unique @map("provider_id")

  // Google Places Data
  placeId               String   @unique @map("place_id")
  businessName          String   @map("business_name")
  formattedAddress      String   @map("formatted_address")

  // Address Components
  streetNumber          String?  @map("street_number")
  streetName            String?  @map("street_name")
  city                  String?
  state                 String?
  postalCode            String?  @map("postal_code")
  country               String?

  // Location
  lat                   Decimal  @db.Decimal(10, 8)
  lng                   Decimal  @db.Decimal(11, 8)

  // Business Info
  rating                Decimal? @db.Decimal(2, 1)
  reviewsCount          Int?     @map("reviews_count")
  phone                 String?
  website               String?

  // Additional Data
  photos                Json?    // Array of photo references
  types                 Json?    // Array of business types
  dataRaw               Json?    @map("data_raw") // Full API response

  fetchedAt             DateTime @default(now()) @map("fetched_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  provider              Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([placeId])
  @@map("google_business_profiles")
}
```

**ProviderSettings:**
```prisma
model ProviderSettings {
  id                        String   @id @default(uuid())
  providerId                String   @unique @map("provider_id")

  // Regional Settings
  currency                  String   // ISO 4217 currency code
  timezone                  String   // IANA timezone

  // Deposit Settings
  depositRequired           Boolean  @default(false) @map("deposit_required")
  depositType               String?  @map("deposit_type") // 'percentage' | 'fixed'
  depositPercentage         Int?     @map("deposit_percentage")
  depositFixedAmount        Decimal? @map("deposit_fixed_amount") @db.Decimal(10, 2)

  // Cancellation Policy
  cancellationPolicy        String   @default("moderate") @map("cancellation_policy") // 'flexible' | 'moderate' | 'strict' | 'custom'
  cancellationPolicyCustom  Json?    @map("cancellation_policy_custom")

  createdAt                 DateTime @default(now()) @map("created_at")
  updatedAt                 DateTime @updatedAt @map("updated_at")

  provider                  Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@map("provider_settings")
}
```

**VerificationDocument:**
```prisma
model VerificationDocument {
  id                      String   @id @default(uuid())
  providerId              String   @map("provider_id")
  documentType            String   @map("document_type") // 'business_registration' | 'insurance_certificate'
  fileUrl                 String   @map("file_url")
  fileName                String?  @map("file_name")
  fileSizeBytes           Int?     @map("file_size_bytes")
  mimeType                String?  @map("mime_type")

  // OCR Extracted Data
  extractedData           Json?    @map("extracted_data")
  extractionConfidence    Decimal? @map("extraction_confidence") @db.Decimal(3, 2)
  extractionRawText       String?  @map("extraction_raw_text") @db.Text

  // Insurance-specific
  insuranceProvider       String?  @map("insurance_provider")
  insurancePolicyNumber   String?  @map("insurance_policy_number")
  insuranceCoverageAmount Decimal? @map("insurance_coverage_amount") @db.Decimal(15, 2)
  insuranceCoverageCurrency String? @map("insurance_coverage_currency")
  insuranceEffectiveDate  DateTime? @map("insurance_effective_date") @db.Date
  insuranceExpirationDate DateTime? @map("insurance_expiration_date") @db.Date
  insuranceCoverageTypes  Json?    @map("insurance_coverage_types")

  // Business Registration-specific
  registrationNumber      String?  @map("registration_number")
  registrationDate        DateTime? @map("registration_date") @db.Date
  registrationAuthority   String?  @map("registration_authority")
  registrationStatus      String?  @map("registration_status")

  // Verification
  autoChecksPassed        Boolean? @map("auto_checks_passed")
  autoChecksResults       Json?    @map("auto_checks_results")
  reviewStatus            String   @default("pending") @map("review_status") // 'pending' | 'approved' | 'rejected' | 'needs_reupload'
  reviewedByAdminId       String?  @map("reviewed_by_admin_id")
  reviewedAt              DateTime? @map("reviewed_at")
  reviewChecklist         Json?    @map("review_checklist")
  reviewNotes             String?  @map("review_notes") @db.Text

  uploadedAt              DateTime @default(now()) @map("uploaded_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  provider                Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@index([providerId])
  @@index([reviewStatus])
  @@index([documentType])
  @@map("verification_documents")
}
```

**ProviderConversation (for future use):**
```prisma
model ProviderConversation {
  id                String   @id @default(uuid())
  providerId        String   @map("provider_id")
  subject           String   // 'application_review' | 'document_verification' | 'general'
  status            String   @default("open") // 'open' | 'closed'
  priority          String   @default("normal") // 'low' | 'normal' | 'high' | 'urgent'
  assignedAdminId   String?  @map("assigned_admin_id")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  closedAt          DateTime? @map("closed_at")

  provider          Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  assignedAdmin     User?    @relation("AssignedConversations", fields: [assignedAdminId], references: [id])
  messages          ProviderMessage[]

  @@index([providerId])
  @@index([assignedAdminId])
  @@index([status])
  @@map("provider_conversations")
}
```

**ProviderMessage (for future use):**
```prisma
model ProviderMessage {
  id                String   @id @default(uuid())
  conversationId    String   @map("conversation_id")
  senderId          String   @map("sender_id")
  senderType        String   @map("sender_type") // 'provider' | 'admin'
  messageText       String   @map("message_text") @db.Text
  attachments       Json?    // Array of file URLs

  isRead            Boolean  @default(false) @map("is_read")
  readAt            DateTime? @map("read_at")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  conversation      ProviderConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender            User     @relation("SentMessages", fields: [senderId], references: [id])

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
  @@map("provider_messages")
}
```

**Note:** ProviderConversation and ProviderMessage models are included in the schema for data storage but will not have backend implementation in this epic. Messaging functionality will be implemented in a separate epic.

**EmailVerification (extend existing):**
- Add `verificationType` field: 'user_registration' | 'provider_onboarding'
- Add `providerId` field (nullable FK to Provider)
- Add index on `providerId`

### 1.3 Enums

Add the following enums to the Prisma schema:

```prisma
enum DepositType {
  percentage
  fixed
}

enum CancellationPolicy {
  flexible
  moderate
  strict
  custom
}

enum ApprovalStatus {
  pending
  under_review
  info_requested
  approved
  rejected
  suspended
}

enum DocumentReviewStatus {
  pending
  approved
  rejected
  needs_reupload
}

enum ConversationStatus {
  open
  closed
}

enum ConversationPriority {
  low
  normal
  high
  urgent
}

enum MessageSenderType {
  provider
  admin
}
```

**Note:** Camp-related enums (CampType) are not included as camp/session functionality will be implemented in a separate epic.

---

## 2. Backend Implementation

### 2.1 Module Structure

Create the following modules in `apps/wc-nest-api/src/modules/`:

**Provider Context:**
- `provider/onboarding/` - Provider onboarding endpoints
- `provider/documents/` - Document upload/management
- `provider/profile/` - Profile management after approval

**Superadmin Context:**
- `superadmin/provider-applications/` - Application review dashboard
- `superadmin/provider-verification/` - Document verification

**Note:** Messaging modules (provider/conversations, superadmin/provider-conversations) are not included in this implementation. Messaging functionality will be implemented in a separate epic.

### 2.2 API Endpoints

**Provider Onboarding Endpoints:**

```
POST   /api/provider/onboarding/step-1/search-google-place
POST   /api/provider/onboarding/step-1/confirm-business
POST   /api/provider/onboarding/step-2/send-verification-code
POST   /api/provider/onboarding/step-2/verify-email
POST   /api/provider/onboarding/step-2/complete-contact-info
POST   /api/provider/onboarding/step-4/upload-document
DELETE /api/provider/onboarding/step-4/document/:id
POST   /api/provider/onboarding/step-5/save-payment-policies
POST   /api/provider/onboarding/submit-application
GET    /api/provider/onboarding/status
GET    /api/provider/onboarding/progress
```

**Notes:**
- Step 3 (Camp Details) endpoint is out of scope for this epic and will be implemented in the Camp/Session Management epic
- Step 5 endpoint only saves payment/policy settings to ProviderSettings model. Stripe Connect integration endpoints are not included in this implementation

**Superadmin Application Review Endpoints:**

```
GET    /api/superadmin/provider-applications (with pagination, filtering, sorting)
GET    /api/superadmin/provider-applications/:id
PATCH  /api/superadmin/provider-applications/:id/status
POST   /api/superadmin/provider-applications/:id/approve
POST   /api/superadmin/provider-applications/:id/reject
GET    /api/superadmin/provider-applications/:id/trust-score
POST   /api/superadmin/provider-applications/:id/recalculate-trust-score
```

**Superadmin Document Verification Endpoints:**

```
GET    /api/superadmin/verification-documents/:id
PATCH  /api/superadmin/verification-documents/:id/review
POST   /api/superadmin/verification-documents/:id/approve
POST   /api/superadmin/verification-documents/:id/reject
POST   /api/superadmin/verification-documents/:id/request-reupload
```

**Note:** Conversation endpoints (provider and superadmin) are not included in this implementation. Messaging functionality will be implemented in a separate epic.

### 2.3 DTOs

Create DTOs for all endpoints following the existing pattern in `users` and `roles` modules:

**Onboarding DTOs:**
- `SearchGooglePlaceDto` - Query params for Google Places search
- `ConfirmBusinessDto` - Legal business info from Step 1
- `SendVerificationCodeDto` - Email for verification
- `VerifyEmailDto` - Email + 6-digit code
- `CompleteContactInfoDto` - Contact details + legal business info
- `UploadDocumentDto` - Document type, file
- `SavePaymentPoliciesDto` - Deposit settings, cancellation policy, currency, timezone

**Note:** Step 3 (Camp Details) is out of scope for this epic. The SaveCampDetailsDto and related endpoint will be implemented in the Camp/Session Management epic.

**Application Review DTOs:**
- `GetApplicationsQueryDto` - Pagination, filters (status, trust score range, date range)
- `UpdateApplicationStatusDto` - New status
- `ApproveApplicationDto` - Approval notes
- `RejectApplicationDto` - Rejection reason, category

**Document Verification DTOs:**
- `ReviewDocumentDto` - Checklist items, notes
- `ApproveDocumentDto` - Approval notes
- `RejectDocumentDto` - Rejection reason
- `RequestReuploadDto` - Reason for reupload

**Note:** Conversation DTOs (GetConversationsQueryDto, SendMessageDto, AssignConversationDto, CloseConversationDto) are not included in this implementation.

### 2.4 Services

**TrustScoreService:**
- `calculateTrustScore(providerId: string)` - Calculate full trust score
- `calculateGoogleBusinessScore(googleBusinessProfile: GoogleBusinessProfile)` - Max 50 points
- `calculateVerificationDocumentsScore(providerId: string)` - Max 30 points
- `calculateProfileCompletenessScore(provider: Provider)` - Max 20 points
- `getRecommendedAction(trustScore: number)` - Auto-approve, manual review, or high risk

**EmailVerificationService:**
- `sendVerificationCode(email: string, providerId: string)` - Generate 6-digit code, send email
- `verifyCode(email: string, code: string)` - Validate code (10-min expiry)
- `resendCode(email: string)` - Resend with new code

**DocumentProcessingService:**
- `uploadDocument(file: Express.Multer.File, providerId: string, documentType: string)` - Upload to storage
- `extractDocumentData(documentId: string)` - OCR processing
- `runAutomatedChecks(documentId: string)` - Automated verification checks
- `deleteDocument(documentId: string)` - Remove from storage and DB

**GoogleBusinessService:**
- `searchPlace(query: string)` - Call Google Places API
- `getPlaceDetails(placeId: string)` - Fetch detailed place information
- `saveGoogleBusinessProfile(providerId: string, placeId: string)` - Create GoogleBusinessProfile record
- `updateGoogleBusinessProfile(providerId: string)` - Refresh Google data

**ProviderSettingsService:**
- `createSettings(providerId: string, settingsDto: SavePaymentPoliciesDto)` - Create ProviderSettings
- `updateSettings(providerId: string, settingsDto: SavePaymentPoliciesDto)` - Update ProviderSettings
- `getSettings(providerId: string)` - Get provider settings

**OnboardingService:**
- `completeStep(providerId: string, step: number)` - Update onboarding progress
- `submitApplication(providerId: string)` - Final submission, trigger trust score calculation
- `getOnboardingStatus(providerId: string)` - Current step, completion status

**ApplicationReviewService:**
- `getApplications(query: GetApplicationsQueryDto)` - Paginated list with filters
- `getApplicationById(id: string)` - Full application details
- `approveApplication(id: string, adminId: string, notes: string)` - Approve and notify
- `rejectApplication(id: string, adminId: string, reason: string, category: string)` - Reject and notify
- `assignReviewer(id: string, adminId: string)` - Assign admin to application

**Note:** ConversationService is not included in this implementation. Messaging functionality will be implemented in a separate epic.

### 2.5 Permissions

Add the following permissions to the database seed:

**Provider Context:**
- `provider.onboarding.create` - Start onboarding
- `provider.onboarding.update` - Update onboarding steps
- `provider.onboarding.submit` - Submit application
- `provider.documents.upload` - Upload documents
- `provider.documents.delete` - Delete own documents

**Superadmin Context:**
- `provider_applications.read` - View applications
- `provider_applications.review` - Review applications
- `provider_applications.approve` - Approve applications
- `provider_applications.reject` - Reject applications
- `verification_documents.read` - View documents
- `verification_documents.review` - Review documents

**Note:** Conversation-related permissions (provider.conversations.*, provider_conversations.*) are not included in this implementation.

### 2.6 Validation Rules

Implement validation in DTOs using `class-validator`:

**Step 1:**
- Legal company name: required, 2-100 chars
- Legal address fields: required
- Legal country: required, valid country code

**Step 2:**
- Contact first/last name: required, 2-50 chars
- Contact phone: required, valid phone format
- Email: required, valid email, unique
- Password: required, min 8 chars, 1 uppercase, 1 lowercase, 1 number

**Step 3:**
- Description: required, 100-300 chars

**Step 4:**
- Document type: required, enum value
- File: required, max 10MB, allowed types: PDF, JPG, PNG

**Step 5:**
- Currency: required, valid ISO 4217 code
- Timezone: required, valid IANA timezone
- Deposit type: required if depositRequired is true
- Deposit percentage: 10-100 if type is percentage
- Deposit fixed amount: > 0 if type is fixed
- Cancellation policy: required, enum value

---

## 3. Frontend Implementation - Provider App

### 3.1 Routing Structure

Add the following routes to `apps/wc-provider/src/app/`:

```
/onboarding/step-1          - Find Your Camp (Google Places search)
/onboarding/step-2          - Contact & Account (Email verification, password, legal info)
/onboarding/step-3          - About Your Camp (Description, camp type, age range)
/onboarding/step-4          - Verification Documents (Upload business registration, insurance)
/onboarding/step-5          - Payment & Policies (Stripe Connect, deposit, cancellation)
/onboarding/under-review    - Application submitted, awaiting review
/onboarding/conversation    - Messaging with admin reviewer
/onboarding/approved        - Application approved
/onboarding/rejected        - Application rejected
```

### 3.2 Page Components

**Step 1: Find Your Camp**
- Google Places Autocomplete search input
- Map display with selected location marker (desktop only)
- Search results list with business cards
- Confirmation modal with legal business info form
- "This is my camp" button to confirm selection
- Reference: `1_onboarding-step-1-google-search.html`

**Step 2: Contact & Account**
- Email input with verification code flow
- 6-digit code input (auto-focus, auto-submit)
- Resend code button (disabled for 60s)
- Password input with strength indicator
- Contact info form (first name, last name, role, phone)
- Legal business info form (pre-filled from Step 1, editable)
- Reference: `2_onboarding-step-2-contact-account.html`

**Step 3: About Your Camp**
- Description textarea (100-300 chars, live counter)
- Visual preview of camp description
- Reference: `3_onboarding-step-3-about-camp.html`
- **Note:** Camp type and age range fields are NOT included (will be part of Camp/Session management in separate epic)

**Step 4: Verification Documents**
- Two upload sections: Business Registration + Insurance Certificate
- Drag-and-drop file upload zones
- File preview with delete option
- Upload progress indicator
- Document status badges (pending, approved, rejected)
- Reference: `4_onboarding-step-4-documents.html`

**Step 5: Payment & Policies (Frontend UI Only)**
- Stripe Connect button (non-functional, placeholder for future integration)
- Stripe account status indicator (shows "Not Connected" state)
- Currency selector (auto-populated based on country)
- Timezone selector
- Deposit settings toggle + form (percentage or fixed amount)
- Cancellation policy selector (Flexible, Moderate, Strict, Custom)
- Policy descriptions with examples
- Terms and conditions checkbox
- Submit application button
- Reference: `5_onboarding-step-5-payment.html`
- **Note:** Stripe Connect integration is NOT implemented. Button is UI-only placeholder. Backend only saves settings to ProviderSettings model.

**Under Review Status**
- Application submitted confirmation
- Trust score display (if visible to provider)
- Estimated review time (4-24 hours for manual review)
- Reference: `5A_onboarding-under-review.html`
- **Note:** "Message Us" button removed (messaging not in scope)

**Conversation Page (Placeholder)**
- "Coming Soon" placeholder message
- Information about messaging feature being under development
- "Back to Dashboard" button
- Reference: `dev-handoff-5B_onboarding-conversation.md`
- **Note:** Full messaging functionality NOT implemented. Show placeholder UI only.

**Approved Status**
- Congratulations message
- Next steps (complete profile, add camp sessions)
- "Go to Dashboard" button
- Reference: `5C_onboarding-approved.html`

**Rejected Status**
- Rejection message
- Rejection reason and category
- "Contact Support" button (links to email or external support)
- Reference: `5D_onboarding-rejected.html`
- **Note:** Option to start new application removed (business logic TBD)

### 3.3 State Management

Use Zustand stores for:

**OnboardingStore:**
- Current step (1-5)
- Step completion status
- Form data for each step
- Google Place selection
- Document upload status
- Provider settings (currency, timezone, deposit, cancellation policy)
- Actions: `setStep`, `saveStepData`, `submitApplication`

**Note:** ConversationStore is not included in this implementation (messaging not in scope).

### 3.4 API Integration

Create API client functions in `apps/wc-provider/src/lib/api/`:

- `onboardingApi.ts` - All onboarding endpoints
- `documentsApi.ts` - Document upload/delete

Use the existing `apiClient` pattern from `wc-frontend-utils`.

**Note:** conversationApi.ts is not included in this implementation (messaging not in scope).

### 3.5 Form Validation

Use React Hook Form with Zod schemas for all forms:

- `step1Schema.ts` - Legal business info validation
- `step2Schema.ts` - Contact info + password validation
- `step3Schema.ts` - Camp description validation (100-300 chars)
- `step4Schema.ts` - Document upload validation
- `step5Schema.ts` - Payment policies validation (currency, timezone, deposit, cancellation)

### 3.6 Progress Indicator

Create a shared progress indicator component:
- Shows steps 1-5 with completion status
- Highlights current step
- Allows navigation to completed steps only
- Sticky position on desktop, collapsible on mobile

---

## 4. Frontend Implementation - Superadmin App

### 4.1 Routing Structure

Add the following routes to `apps/wc-superadmin/src/app/`:

```
/provider-applications              - Applications dashboard (list view)
/provider-applications/:id          - Application detail view
/provider-applications/:id/review   - Review interface with checklist
```

**Note:** Conversation routes (/provider-conversations, /provider-conversations/:id) are not included in this implementation (messaging not in scope).

### 4.2 Page Components

**Applications Dashboard**
- Table view with columns: Provider Name, Trust Score, Status, Submitted Date, Assigned To
- Filters: Status, Trust Score Range, Date Range, Assigned To
- Sorting: Trust Score, Submitted Date, Provider Name
- Pagination (server-side)
- Bulk actions: Assign Reviewer
- Status badges with color coding
- Trust score progress bars
- Quick actions: View, Review, Approve, Reject

**Application Detail View**
- Provider information card (Google Business + Legal Business)
- Contact information
- Camp description
- Verification documents with preview
- Trust score breakdown (Google: X/50, Documents: X/30, Profile: X/20)
- Timeline of status changes
- Assigned reviewer info
- Action buttons: Approve, Reject, Assign

**Review Interface**
- Split view: Application details (left) + Review checklist (right)
- Document viewer with zoom, rotate, download
- Checklist items:
  - Google Business verification
  - Legal business info accuracy
  - Contact info verification
  - Camp description completeness
  - Business registration document
  - Insurance certificate
- Notes textarea for each checklist item
- Overall review notes
- Decision buttons: Approve, Reject

**Note:** Conversations Dashboard and Conversation Detail View are not included in this implementation (messaging not in scope). "Request Info" action button removed from Application Detail View.

### 4.3 State Management

Use Zustand stores for:

**ApplicationsStore:**
- Applications list
- Filters and sorting
- Pagination state
- Selected application
- Actions: `loadApplications`, `filterApplications`, `selectApplication`

**ReviewStore:**
- Current application under review
- Checklist state
- Review notes
- Actions: `loadApplication`, `updateChecklist`, `submitReview`

**Note:** ConversationsStore is not included in this implementation (messaging not in scope).

### 4.4 API Integration

Create API client functions in `apps/wc-superadmin/src/lib/api/`:

- `providerApplicationsApi.ts` - Application review endpoints
- `verificationDocumentsApi.ts` - Document verification endpoints

**Note:** providerConversationsApi.ts is not included in this implementation (messaging not in scope).

### 4.5 Data Tables

Use HeroUI Table component with:
- Server-side pagination
- Server-side filtering
- Server-side sorting
- Column visibility toggle
- Export to CSV functionality
- Responsive design (card view on mobile)

---

## 5. Icon Package Recommendation

### 5.1 Analysis of HTML Mockup Icons

After reviewing the HTML mockups in `/Users/daniyal/files/dev/ws-server-setup/WC-Booking/Provider/1_onboarding/`, I found that they use **native emoji characters** for decorative, illustrative icons:
- ⏱️ (timer/clock) - for estimated review time
- 📧 (envelope) - for email confirmation
- ⚠️ (warning) - for validation errors
- ⭐ (star) - for ratings
- 📊 (chart) - for analytics

### 5.2 Recommendation: Native Emoji with Centralized Constants

**Use native emoji characters for decorative/illustrative icons in the provider onboarding feature.**

#### Why Native Emoji?

**Advantages:**
- ✅ **Zero dependencies** - No additional package needed
- ✅ **Perfect match** - Exactly matches the HTML mockup style
- ✅ **Colorful & friendly** - Native emoji are inherently illustrative
- ✅ **Cross-platform** - Renders consistently across modern browsers
- ✅ **Accessible** - Screen readers handle emoji well with proper ARIA labels
- ✅ **Small bundle size** - No icon library overhead

**Disadvantages:**
- ❌ **Platform-dependent rendering** - Emoji may look slightly different on iOS vs Android vs Windows (acceptable for decorative use)
- ❌ **Limited customization** - Cannot change colors (not needed for this use case)

#### Implementation: Centralized Emoji Constants File

**Create a centralized emoji constants file** to avoid copy-pasting emoji throughout the codebase and ensure consistency.

**File: `packages/wc-frontend-utils/src/lib/emoji.ts`**

```typescript
/**
 * Centralized emoji constants for World Camps applications
 *
 * Usage:
 * import { EMOJI } from '@world-schools/wc-frontend-utils'
 * <span className="icon">{EMOJI.TIMER}</span>
 */

export const EMOJI = {
  // Time & Calendar
  TIMER: '⏱️',
  CLOCK: '🕐',
  CALENDAR: '📅',
  HOURGLASS: '⏳',

  // Communication
  EMAIL: '📧',
  MESSAGE: '💬',
  PHONE: '📞',
  BELL: '🔔',

  // Status & Feedback
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  STAR: '⭐',

  // Celebration & Emotion
  PARTY: '🎉',
  CONFETTI: '🎊',
  CLAP: '👏',
  SPARKLES: '✨',
  TROPHY: '🏆',

  // Analytics & Data
  CHART: '📊',
  GRAPH: '📈',
  DOCUMENT: '📄',
  CLIPBOARD: '📋',

  // Camp & Activities
  TENT: '🏕️',
  SUN: '☀️',
  TREE: '🌲',
  MOUNTAIN: '⛰️',

  // Actions & Objects
  UPLOAD: '📤',
  DOWNLOAD: '📥',
  SEARCH: '🔍',
  LOCK: '🔒',
  KEY: '🔑',
} as const

export type EmojiKey = keyof typeof EMOJI
```

**Export from package index:**

Add to `packages/wc-frontend-utils/src/index.ts`:
```typescript
export { EMOJI, type EmojiKey } from './lib/emoji'
```

#### Usage Examples

**In React components:**

```tsx
import { EMOJI } from '@world-schools/wc-frontend-utils'

// Timeline icon
<span className="timeline-icon" role="img" aria-label="Timer">
  {EMOJI.TIMER}
</span>

// Email confirmation
<span className="email-icon" role="img" aria-label="Email">
  {EMOJI.EMAIL}
</span>

// Status indicator
<span className="status-icon" role="img" aria-label="Success">
  {EMOJI.CHECK}
</span>
```

**Accessibility best practice:**
Always include `role="img"` and `aria-label` when using emoji for semantic meaning.

### 5.3 For Functional UI Icons: Use Existing lucide-react

For functional UI elements (buttons, navigation, forms, actions), **continue using lucide-react** which is already installed:

```tsx
import { Menu, X, ChevronLeft, Upload, Search } from 'lucide-react'

// Navigation
<Menu size={24} />

// Form controls
<Search size={20} />
<Upload size={20} />
```

**lucide-react is already installed and provides:**
- ✅ 1,500+ simple, clean line icons
- ✅ Fully customizable (size, color, stroke width)
- ✅ TypeScript support
- ✅ Tree-shakeable
- ✅ Consistent with existing codebase

### 5.4 Icon Usage Guidelines

**Use Native Emoji (from EMOJI constants) for:**
- Decorative timeline icons (⏱️, 📧, 🎉)
- Status page illustrations (✅, ❌, ⏳)
- Empty state illustrations
- Celebratory/emotional moments (🎊, 👏, 🌟)
- Non-critical visual enhancements
- Large decorative elements that benefit from color

**Use lucide-react for:**
- Navigation icons (menu, close, back, chevron)
- Form controls (search, upload, delete, edit)
- Action buttons (save, cancel, download)
- Interactive elements that need hover states
- Icons that need to match brand colors
- Small functional icons in buttons and inputs

### 5.5 Why NOT Install Additional Icon Libraries

After researching emoji helper libraries (emoji-mart, emoji-picker-react, etc.), I found that:
- ❌ **No suitable libraries exist** for simply managing emoji as constants
- ❌ **Existing libraries are emoji pickers** (for user selection), not constant management tools
- ❌ **Additional dependencies are unnecessary** when a simple constants file solves the problem
- ✅ **Centralized constants file provides:**
  - Type safety (TypeScript autocomplete)
  - Consistency (single source of truth)
  - Discoverability (developers can see all available emoji)
  - Zero bundle size overhead
  - Easy to maintain and extend

### 5.6 Final Recommendation Summary

1. **Create `packages/wc-frontend-utils/src/lib/emoji.ts`** with centralized emoji constants
2. **Export EMOJI from package index** for easy importing
3. **Use native emoji** for decorative/illustrative icons that match the HTML mockups
4. **Use lucide-react** for functional UI icons (already installed)
5. **Follow accessibility best practices** (role="img", aria-label)
6. **No additional icon libraries needed**

---

## 6. Color Mapping

### 6.1 Overview

This section maps the colors used in the HTML mockups (from `/Users/daniyal/files/dev/ws-server-setup/WC-Booking/Provider/1_onboarding/`) to the **existing theme colors** defined in `packages/wc-frontend-utils/src/lib/theme-config.ts`.

**Important:** Do NOT modify the theme configuration. Use the existing color palette for consistency across all World Camps applications.

### 6.2 HTML Mockup Colors → Existing Theme Colors

Map the CSS custom properties from the HTML mockups to the existing HeroUI theme tokens:

| HTML Mockup Variable | Hex Code | Existing Theme Token | Tailwind Class | Usage in Onboarding |
|----------------------|----------|----------------------|----------------|---------------------|
| `--primary` | #45F0B5 | `primary.DEFAULT` | `bg-primary`, `text-primary` | Primary buttons, links, highlights, active states |
| `--primary-hover` | #3de0a5 | `primary.600` | `hover:bg-primary-600` | Button hover states |
| `--primary-light` | #E8FDF7 | `primary.50` | `bg-primary-50` | Light backgrounds, info banners, badges |
| `--text-primary` | #222222 | `foreground` | `text-foreground` | Main body text, headings |
| `--text-secondary` | #717171 | `default.600` | `text-default-600` | Secondary text, labels, descriptions |
| `--text-light` | #AAAAAA | `default.400` | `text-default-400` | Placeholder text, disabled text |
| `--border` | #E5E5E5 | `default.200` | `border-default-200` | Input borders, dividers, card borders |
| `--border-light` | #F0F0F0 | `default.100` | `border-default-100` | Subtle dividers |
| `--background` | #FFFFFF | `background` | `bg-background` | Page background |
| `--background-gray` | #F7F7F7 | `default.50` | `bg-default-50` | Card backgrounds, section backgrounds |

**Note:** The HTML mockups use `--success`, `--warning`, and `--danger` colors that differ from the current theme. See Section 6.3 for how to handle these semantic colors.

### 6.3 Semantic Colors (Success, Warning, Danger)

The HTML mockups use different semantic colors than the current theme. **Use the existing theme colors** for consistency:

| HTML Mockup Variable | Mockup Hex | Existing Theme Token | Existing Hex | Tailwind Class | Usage |
|----------------------|------------|----------------------|--------------|----------------|-------|
| `--success` | #00BA88 | `success.DEFAULT` | #23874e | `text-success`, `bg-success` | Success states, approvals, checkmarks |
| `--warning` | #FFB800 | `warning.DEFAULT` | #936316 | `text-warning`, `bg-warning` | Warning states, pending reviews |
| `--danger` | #FF385C | `danger.DEFAULT` | #c20e4d | `text-danger`, `bg-danger` | Error states, rejections, required fields |

**Implementation Note:** While the mockup colors are brighter/more saturated, use the existing theme colors to maintain consistency across all World Camps applications. The existing colors are already accessible and tested.

### 6.4 Additional Colors from Mockups

Some HTML mockups include additional colors not in the base theme. Map these to the closest existing theme colors:

| HTML Mockup Variable | Hex Code | Closest Theme Token | Tailwind Class | Usage |
|----------------------|----------|---------------------|----------------|-------|
| `--info` | #3B82F6 | Use `primary` instead | `text-primary`, `bg-primary` | Info states (use primary color) |
| `--info-light` | #EFF6FF | Use `primary-50` instead | `bg-primary-50` | Info backgrounds |
| `--warning-light` | #FFF8E6 | Use `warning-50` instead | `bg-warning-50` | Warning backgrounds |

### 6.5 Trust Score Color Coding

Map trust score ranges to existing theme colors:

| Trust Score Range | Meaning | Theme Color | Tailwind Class | Visual Treatment |
|-------------------|---------|-------------|----------------|------------------|
| 70-100 | Auto-approve | `success` (#23874e) | `text-success` | Green text/icon |
| 40-69 | Manual review | `warning` (#936316) | `text-warning` | Orange/amber text/icon |
| 0-39 | High risk | `danger` (#c20e4d) | `text-danger` | Red text/icon |

**Example Usage:**
```tsx
import { EMOJI } from '@world-schools/wc-frontend-utils'

// Trust score display
const getTrustScoreColor = (score: number) => {
  if (score >= 70) return 'text-success'
  if (score >= 40) return 'text-warning'
  return 'text-danger'
}

<div className={getTrustScoreColor(trustScore)}>
  <span>{EMOJI.CHART}</span>
  <span className="font-bold">{trustScore}/100</span>
</div>
```

### 6.6 Status Badge Color Mapping

Map application status badges to existing theme colors:

| Status | Background Color | Text Color | Border Color | Implementation |
|--------|------------------|------------|--------------|----------------|
| **Pending** | `warning-50` (#fdedd3) | `warning` (#936316) | `warning` (#936316) | `bg-warning-50 text-warning border-warning` |
| **Under Review** | `primary-50` (#dcfeee) | `primary-600` (#22c192) | `primary-600` (#22c192) | `bg-primary-50 text-primary-600 border-primary-600` |
| **Info Requested** | `warning-50` (#fdedd3) | `warning` (#936316) | `warning` (#936316) | `bg-warning-50 text-warning border-warning` |
| **Approved** | `success-50` (#d1f4e0) | `success` (#23874e) | `success` (#23874e) | `bg-success-50 text-success border-success` |
| **Rejected** | `danger-50` (#fdd0df) | `danger` (#c20e4d) | `danger` (#c20e4d) | `bg-danger-50 text-danger border-danger` |
| **Suspended** | `default-50` (#F7F7F7) | `default-600` (#717171) | `default-400` (#AAAAAA) | `bg-default-50 text-default-600 border-default-400` |

**Example StatusBadge Component:**
```tsx
import { Badge } from '@heroui/react'

type Status = 'pending' | 'under_review' | 'info_requested' | 'approved' | 'rejected' | 'suspended'

const statusConfig = {
  pending: { color: 'warning', label: 'Pending' },
  under_review: { color: 'primary', label: 'Under Review' },
  info_requested: { color: 'warning', label: 'Info Requested' },
  approved: { color: 'success', label: 'Approved' },
  rejected: { color: 'danger', label: 'Rejected' },
  suspended: { color: 'default', label: 'Suspended' },
} as const

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status]
  return (
    <Badge color={config.color} variant="flat">
      {config.label}
    </Badge>
  )
}
```

### 6.7 Form Validation Colors

Map form validation states to existing theme colors:

| Validation State | Border Color | Background Color | Text Color | Icon Color |
|------------------|--------------|------------------|------------|------------|
| **Default** | `default-200` (#E5E5E5) | `background` (#FFFFFF) | `foreground` (#222222) | `default-600` (#717171) |
| **Focus** | `primary` (#45F0B5) | `background` (#FFFFFF) | `foreground` (#222222) | `primary` (#45F0B5) |
| **Success** | `success` (#23874e) | `success-50` (#d1f4e0) | `success` (#23874e) | `success` (#23874e) |
| **Error** | `danger` (#c20e4d) | `danger-50` (#fdd0df) | `danger` (#c20e4d) | `danger` (#c20e4d) |

**Example Implementation:**
```tsx
<Input
  label="Business Name"
  isRequired
  classNames={{
    input: 'text-foreground',
    inputWrapper: 'border-default-200 focus-within:border-primary',
  }}
/>

<Input
  label="Email"
  isInvalid={hasError}
  errorMessage="Invalid email address"
  classNames={{
    input: 'text-foreground',
    inputWrapper: hasError ? 'border-danger bg-danger-50' : 'border-default-200',
  }}
/>
```

### 6.8 Summary: Key Tailwind Classes for Onboarding

Quick reference for the most commonly used color classes in the provider onboarding feature:

**Backgrounds:**
- `bg-background` - Page background (white)
- `bg-default-50` - Card/section background (light gray)
- `bg-primary` - Primary button background (teal)
- `bg-primary-50` - Light primary background (light teal)

**Text:**
- `text-foreground` - Main body text (dark gray)
- `text-default-600` - Secondary text (medium gray)
- `text-default-400` - Placeholder text (light gray)
- `text-primary` - Primary colored text (teal)
- `text-success` - Success text (green)
- `text-warning` - Warning text (amber)
- `text-danger` - Error text (red)

**Borders:**
- `border-default-200` - Default borders (light gray)
- `border-primary` - Primary borders (teal)
- `focus:border-primary` - Focus state borders

**Interactive States:**
- `hover:bg-primary-600` - Primary button hover
- `hover:bg-default-50` - Secondary button hover
- `focus:ring-primary` - Focus ring color

---

## 7. Shared Component Strategy

### 7.1 Components for @world-schools/ui-web

These are generic, reusable components that could be used across any app in the monorepo:

**Form Components:**
- `FileUploadZone` - Drag-and-drop file upload with preview
- `CodeInput` - 6-digit verification code input with auto-focus
- `PhoneInput` - International phone number input with country selector
- `PasswordInput` - Password input with strength indicator
- `CharacterCounter` - Textarea with live character count
- `CurrencySelector` - Currency dropdown with search
- `TimezoneSelector` - Timezone dropdown with search

**Display Components:**
- `StatusBadge` - Colored badge with icon for status display
- `ProgressBar` - Linear progress bar with percentage
- `TrustScoreDisplay` - Trust score with breakdown visualization
- `DocumentPreview` - Document viewer with zoom, rotate, download
- `Timeline` - Vertical timeline for status changes

**Layout Components:**
- `StepIndicator` - Multi-step progress indicator
- `SplitView` - Responsive split-pane layout
- `EmptyState` - Empty state with icon, message, and action button
- `LoadingState` - Skeleton loaders for different content types

**Utility Components:**
- `ConfirmDialog` - Confirmation dialog with custom content
- `InfoTooltip` - Tooltip with info icon trigger
- `CopyButton` - Button to copy text to clipboard
- `ExportButton` - Export data to CSV/PDF

**Note:** RangeSlider (for age selection) and MessageBubble (for chat) are not included in this implementation as they are not needed for the reduced scope.

### 7.2 Components for @world-schools/wc-frontend-utils

These are World Camps-specific components that share business logic:

**Onboarding Components:**
- `GooglePlacesSearch` - Google Places autocomplete with map
- `BusinessInfoCard` - Display Google Business data
- `LegalBusinessForm` - Legal business information form
- `CampDescriptionForm` - Camp description form (100-300 chars with counter)
- `DepositSettingsForm` - Deposit configuration form
- `CancellationPolicySelector` - Cancellation policy selector with descriptions
- `StripeConnectPlaceholder` - Placeholder UI for Stripe Connect (non-functional)

**Application Review Components:**
- `ApplicationCard` - Provider application summary card
- `TrustScoreBreakdown` - Detailed trust score breakdown
- `VerificationChecklist` - Document verification checklist
- `ReviewNotesEditor` - Rich text editor for review notes
- `ApprovalDecisionPanel` - Approve/Reject decision panel

**Provider Components:**
- `ProviderInfoCard` - Provider information display
- `ProviderStatusBadge` - Provider-specific status badge
- `ProviderDocumentList` - List of verification documents
- `ProviderTimelineEvent` - Timeline event for provider actions

**Note:** Conversation components (ConversationThread, MessageComposer, TypingIndicator, ConversationHeader) are not included in this implementation (messaging not in scope).

### 7.3 Component API Design Principles

**Consistency:**
- All components use HeroUI as the base component library
- Follow HeroUI's prop naming conventions (e.g., `color`, `size`, `variant`)
- Use consistent prop names across similar components (e.g., `isLoading`, `isDisabled`)

**Flexibility:**
- Accept `className` prop for custom styling
- Support both controlled and uncontrolled modes where applicable
- Provide sensible defaults for all optional props

**Accessibility:**
- All interactive components have proper ARIA labels
- Keyboard navigation support
- Focus management for modals and dialogs
- Screen reader announcements for dynamic content

**TypeScript:**
- Fully typed props with JSDoc comments
- Export prop types for reuse
- Use discriminated unions for variant-specific props

**Example Component API:**

```typescript
interface FileUploadZoneProps {
  // Required
  onFileSelect: (file: File) => void

  // Optional
  accept?: string
  maxSizeBytes?: number
  multiple?: boolean
  disabled?: boolean

  // Display
  label?: string
  description?: string
  errorMessage?: string

  // State
  isLoading?: boolean
  uploadProgress?: number

  // Styling
  className?: string
  variant?: 'default' | 'compact'

  // Preview
  preview?: {
    url: string
    name: string
    size: number
  }
  onPreviewDelete?: () => void
}
```

### 7.4 Shared Utilities

Create shared utility functions in `@world-schools/wc-frontend-utils`:

**Formatting:**
- `formatTrustScore(score: number)` - Format trust score with color
- `formatCurrency(amount: number, currency: string)` - Format currency
- `formatPhoneNumber(phone: string, countryCode: string)` - Format phone
- `formatFileSize(bytes: number)` - Format file size (KB, MB)

**Validation:**
- `validateEmail(email: string)` - Email validation
- `validatePhone(phone: string)` - Phone validation
- `validatePassword(password: string)` - Password strength validation
- `validateFileType(file: File, allowedTypes: string[])` - File type validation
- `validateFileSize(file: File, maxBytes: number)` - File size validation

**Date/Time:**
- `formatRelativeTime(date: Date)` - "2 hours ago", "3 days ago"
- `formatReviewTime(trustScore: number)` - "4-24 hours", "1-3 days"
- `isWithinExpiry(date: Date, expiryMinutes: number)` - Check if code is expired

**Trust Score:**
- `getTrustScoreColor(score: number)` - Get color based on score
- `getTrustScoreLabel(score: number)` - "Excellent", "Good", "Needs Review"
- `getRecommendedAction(score: number)` - "Auto-approve", "Manual review"

---

## 8. Implementation Phases

### Phase 1: Database & Backend Foundation (Week 1)

**Tasks:**
1. Update Prisma schema with all new models (GoogleBusinessProfile, ProviderSettings, VerificationDocument, ProviderConversation, ProviderMessage)
2. Extend Provider model with new fields
3. Add new enums (DepositType, CancellationPolicy, ApprovalStatus, DocumentReviewStatus, etc.)
4. Run migrations and update Prisma Client
5. Create module structure for provider and superadmin contexts
6. Implement DTOs for all endpoints
7. Set up permissions and seed data
8. Create base services (TrustScoreService, EmailVerificationService, GoogleBusinessService, ProviderSettingsService)

**Deliverables:**
- Updated database schema with GoogleBusinessProfile and ProviderSettings models
- Module structure in place
- DTOs defined
- Permissions seeded
- Base services created

### Phase 2: Provider Onboarding Backend (Week 2)

**Tasks:**
1. Implement GoogleBusinessService (search, fetch details, save profile)
2. Implement ProviderSettingsService (create, update settings)
3. Implement OnboardingService with all business logic
4. Create onboarding controllers and endpoints (Steps 1-5)
5. Integrate Google Places API
6. Implement email verification flow
7. Set up document upload to Azure Blob Storage
8. Implement DocumentProcessingService (upload, OCR, automated checks)
9. Implement trust score calculation
10. Write unit tests for services

**Deliverables:**
- All provider onboarding endpoints functional
- Google Places integration working
- Email verification working
- Document upload working
- Trust score calculation implemented
- Step 5 saves settings to ProviderSettings (no Stripe integration)

### Phase 3: Superadmin Review Backend (Week 3)

**Tasks:**
1. Implement ApplicationReviewService
2. Create application review controllers and endpoints
3. Implement document verification endpoints
4. Write unit tests for services

**Deliverables:**
- All superadmin review endpoints functional
- Document verification working
- Application approval/rejection workflow complete

**Note:** Conversation endpoints and WebSocket support are not included in this phase (messaging not in scope).

### Phase 4: Shared Components & Theme (Week 4)

**Tasks:**
1. Install @phosphor-icons/react
2. Update theme configuration with new colors
3. Create all shared components in @world-schools/ui-web
4. Create WC-specific components in @world-schools/wc-frontend-utils
5. Create shared utility functions
6. Write Storybook stories for all components (optional)

**Deliverables:**
- Icon package installed and configured
- Theme updated with new colors
- All shared components implemented
- Utility functions created
- Component documentation

### Phase 5: Provider App Frontend (Week 5-6)

**Tasks:**
1. Create routing structure
2. Implement Step 1: Find Your Camp (Google Places search with map)
3. Implement Step 2: Contact & Account (email verification, password, contact info)
4. Implement Step 3: About Your Camp (description only, 100-300 chars)
5. Implement Step 4: Verification Documents (drag-and-drop upload)
6. Implement Step 5: Payment & Policies (UI only - currency, timezone, deposit, cancellation)
7. Implement status pages (under review, approved, rejected)
8. Implement conversation page placeholder ("Coming Soon" message)
9. Create OnboardingStore for state management
10. Implement API integration (onboardingApi, documentsApi)
11. Add form validation with React Hook Form + Zod
12. Create progress indicator component

**Deliverables:**
- All onboarding pages functional (Steps 1-5)
- Status pages implemented (under review, approved, rejected)
- Conversation page shows placeholder
- State management working
- API integration complete
- Form validation working
- Step 5 is frontend-only (no Stripe backend integration)

### Phase 6: Superadmin App Frontend (Week 7)

**Tasks:**
1. Create routing structure
2. Implement Applications Dashboard with table, filters, sorting
3. Implement Application Detail View
4. Implement Review Interface with checklist
5. Create ApplicationsStore and ReviewStore for state management
6. Implement API integration (providerApplicationsApi, verificationDocumentsApi)
7. Add data export functionality

**Deliverables:**
- Applications dashboard functional with server-side pagination/filtering
- Application detail view working
- Review interface with checklist working
- Data tables with server-side operations
- Export functionality

**Note:** Conversations Dashboard and Conversation Detail View are not included (messaging not in scope).

### Phase 7: Integration & Testing (Week 8)

**Tasks:**
1. End-to-end testing of complete onboarding flow (Steps 1-5)
2. Test application review workflow (approve/reject)
3. Test trust score calculation with various scenarios
4. Test document upload and verification
5. Test email verification flow
6. Cross-browser testing
7. Mobile responsiveness testing
8. Performance optimization
9. Security audit

**Deliverables:**
- All features tested and working
- Bugs fixed
- Performance optimized
- Security validated

**Note:** Conversation system testing is not included (messaging not in scope). Stripe Connect integration testing is not included (backend not implemented).

### Phase 8: Documentation & Deployment (Week 9)

**Tasks:**
1. Write API documentation (Swagger)
2. Write user guides for providers (onboarding flow)
3. Write admin guides for superadmins (application review)
4. Update deployment scripts
5. Deploy to staging environment
6. User acceptance testing
7. Deploy to production

**Deliverables:**
- Complete documentation
- Deployed to staging
- UAT completed
- Deployed to production

**Total Timeline:** 9 weeks (reduced from 10 weeks due to removed scope)

---

## 9. Additional Considerations

### 9.1 Google Places API Integration

**Setup:**
- Obtain Google Places API key
- Enable Places API and Maps JavaScript API in Google Cloud Console
- Add API key to environment variables
- Implement rate limiting and caching

**Security:**
- Restrict API key to specific domains (wc-provider app)
- Use server-side API calls for sensitive operations
- Implement request validation

### 9.2 Stripe Connect Integration (Future Epic)

**Current Implementation:**
- Step 5 UI shows Stripe Connect button (non-functional placeholder)
- Backend saves stripeAccountId and related fields to Provider model (for future use)
- No OAuth flow, no API calls, no webhook handlers

**Future Implementation (Separate Epic):**
- Create Stripe Connect account
- Obtain Stripe API keys (test and live)
- Configure webhook endpoints
- Implement OAuth flow for provider onboarding
- Implement account status polling
- Implement payout management

**Note:** Full Stripe Connect integration is intentionally deferred to a separate epic to reduce complexity and allow focused testing of the core onboarding flow.

### 9.3 Document Storage

**Azure Blob Storage:**
- Create container: `verification-documents`
- Implement SAS token generation for secure uploads
- Set up lifecycle management (delete after 7 years)
- Implement virus scanning (Azure Defender)

**File Organization:**
```
verification-documents/
  {providerId}/
    business-registration/
      {documentId}.pdf
    insurance-certificate/
      {documentId}.pdf
```

### 9.4 OCR Processing

**Options:**
1. **Azure Computer Vision** (Recommended)
   - Read API for text extraction
   - Form Recognizer for structured data
   - High accuracy, good pricing

2. **Google Cloud Vision**
   - Document Text Detection
   - Good for handwritten text

3. **AWS Textract**
   - Excellent for forms and tables
   - Higher cost

**Implementation:**
- Process documents asynchronously (queue-based)
- Store raw OCR output in `extractionRawText`
- Parse structured data into specific fields
- Calculate confidence score

### 9.5 Email Templates

Create email templates for:
- Email verification code (6-digit code, 10-min expiry)
- Application submitted confirmation
- Application approved notification
- Application rejected notification
- Document reupload request

Use a template engine (e.g., Handlebars) and store templates in `apps/wc-nest-api/src/templates/emails/`.

**Note:** Email templates for messaging (new message notifications, info requested) are not included in this implementation.

### 9.6 Real-Time Messaging (Future Epic)

**Current Implementation:**
- ProviderConversation and ProviderMessage models exist in schema (for data storage)
- No backend endpoints for messaging
- Conversation page shows "Coming Soon" placeholder

**Future Implementation (Separate Epic):**
- WebSocket implementation with Socket.IO
- Real-time message delivery
- Typing indicators
- Read receipts
- File attachments
- Conversation assignment and management

**Note:** Messaging functionality is intentionally deferred to a separate epic to reduce complexity and allow focused testing of the core onboarding and review workflows.

### 9.7 Notifications

**In-App Notifications (Current Implementation):**
- Toast notifications for application status changes
- Success/error messages for form submissions

**Email Notifications (Current Implementation):**
- Email verification code
- Application submitted confirmation
- Application approved notification
- Application rejected notification
- Document reupload request

**Future Notifications (Separate Epic):**
- Unread message count in navigation
- New message notifications (email and in-app)
- Push notifications for mobile app

### 9.8 Analytics & Monitoring

**Track Metrics:**
- Onboarding completion rate by step
- Average time to complete onboarding
- Trust score distribution
- Approval/rejection rates
- Average review time
- Document verification success rate
- Conversation response time

**Monitoring:**
- API endpoint performance
- Error rates
- Document upload success rate
- Email delivery rate
- Stripe Connect success rate

### 9.9 Security Considerations

**Data Protection:**
- Encrypt sensitive data at rest (insurance policy numbers, registration numbers)
- Use HTTPS for all communications
- Implement CSRF protection
- Sanitize all user inputs
- Validate file uploads (type, size, content)

**Access Control:**
- Providers can only access their own data
- Admins can access all provider data
- Implement row-level security in database queries
- Use permission-based access control

**Audit Logging:**
- Log all application status changes
- Log all document verification actions
- Log all admin actions
- Store IP addresses and timestamps

### 9.10 Performance Optimization

**Backend:**
- Implement caching for Google Places API responses (24 hours)
- Use database indexes on frequently queried fields
- Implement pagination for all list endpoints
- Use connection pooling for database
- Optimize Prisma queries (select only needed fields)

**Frontend:**
- Lazy load images and documents
- Implement infinite scroll for message threads
- Use React.memo for expensive components
- Debounce search inputs
- Optimize bundle size (code splitting)

**File Uploads:**
- Implement chunked uploads for large files
- Show upload progress
- Support resume on failure
- Compress images before upload

---

## 10. Testing Strategy

### 10.1 Backend Testing

**Unit Tests:**
- Test all service methods
- Test trust score calculation with various inputs
- Test email verification code generation and validation
- Test document validation logic
- Test permission checks

**Integration Tests:**
- Test API endpoints with real database
- Test Google Places API integration
- Test Stripe Connect integration
- Test file upload to Azure Blob Storage
- Test email sending

**E2E Tests:**
- Test complete onboarding flow
- Test application review workflow
- Test conversation flow

### 10.2 Frontend Testing

**Component Tests:**
- Test all shared components in isolation
- Test form validation
- Test file upload component
- Test message composer

**Integration Tests:**
- Test page components with mocked API
- Test state management (Zustand stores)
- Test routing and navigation

**E2E Tests:**
- Test complete onboarding flow in browser
- Test application review workflow
- Test conversation flow
- Test responsive design on different devices

### 10.3 Test Scenarios

**Onboarding Flow:**
1. Happy path: Complete all steps, auto-approved (trust score ≥70)
2. Manual review: Complete all steps, manual review needed (trust score 40-69)
3. High risk: Complete all steps, extended review (trust score <40)
4. Email verification: Invalid code, expired code, resend code
5. Document upload: Invalid file type, file too large, upload failure
6. Step 3: Description validation (100-300 chars)
7. Step 5: Currency and timezone auto-selection based on country
8. Step 5: Deposit settings validation (percentage 10-100, fixed amount > 0)

**Application Review:**
1. Approve application with high trust score
2. Reject application with low trust score
3. Verify documents and approve
4. Reject documents and request reupload
5. Assign application to reviewer
6. View trust score breakdown

**Note:** Stripe Connect testing and conversation testing are not included in this implementation.

---

## 11. Success Metrics

### 11.1 Onboarding Metrics

- **Completion Rate:** % of providers who complete all 5 steps
- **Drop-off Rate by Step:** % of providers who abandon at each step
- **Average Time to Complete:** Time from Step 1 to submission
- **Email Verification Success Rate:** % of successful email verifications
- **Document Upload Success Rate:** % of successful document uploads
- **Step 3 Completion Rate:** % of providers who complete camp description
- **Step 5 Completion Rate:** % of providers who complete payment settings

### 11.2 Review Metrics

- **Average Review Time:** Time from submission to decision
- **Auto-Approval Rate:** % of applications auto-approved (trust score ≥70)
- **Manual Review Rate:** % of applications requiring manual review
- **Approval Rate:** % of applications approved
- **Rejection Rate:** % of applications rejected
- **Document Reupload Request Rate:** % of applications requiring document reupload

### 11.3 Trust Score Metrics

- **Average Trust Score:** Mean trust score of all applications
- **Trust Score Distribution:** Breakdown by score ranges (0-39, 40-69, 70-100)
- **Google Business Score:** Average score from Google data
- **Document Verification Score:** Average score from documents
- **Profile Completeness Score:** Average score from profile data

### 11.4 Conversation Metrics (Future Epic)

**Note:** Conversation metrics are not applicable to this implementation as messaging functionality is not included. These metrics will be tracked in a future epic when messaging is implemented.

---

## 12. Future Enhancements

### 12.1 High Priority Features (Separate Epics)

**Stripe Connect Integration:**
- OAuth flow for Stripe Connect onboarding
- Account status polling and webhooks
- Payout management
- Payment settings configuration
- Make Step 5 fully functional with backend integration

**Messaging System:**
- Real-time messaging with WebSocket (Socket.IO)
- Conversation management (provider ↔ admin)
- File attachments in messages
- Typing indicators and read receipts
- Email notifications for new messages
- Make conversation page fully functional

**Camp and Session Management:**
- Camp model and CRUD operations
- Session model with scheduling
- Availability calendar
- Pricing management
- Capacity management
- Age range configuration

### 12.2 Phase 2 Features

- **Provider Dashboard:** Analytics, bookings, revenue
- **Photo Gallery:** Upload and manage camp photos
- **Reviews & Ratings:** Display provider reviews from parents
- **Calendar Integration:** Sync camp sessions with Google Calendar

### 12.3 Advanced Features

- **Enhanced Trust Score:**
  - Social media verification (Facebook, Instagram)
  - Website verification
  - Third-party review aggregation (TripAdvisor, Yelp)
  - Background check integration

- **AI-Powered Document Verification:** Automated document validation using ML
- **Video Verification:** Video call with admin for high-risk applications
- **Background Checks:** Integration with background check services
- **Insurance Verification:** Direct integration with insurance providers
- **Multi-Language Support:** Translate onboarding flow to multiple languages
- **Mobile App:** Native mobile app for providers

### 12.4 Admin Tools

- **Bulk Actions:** Approve/reject multiple applications at once
- **Advanced Filters:** Filter by trust score components, document status, saved presets
- **Reporting Dashboard:** Analytics on applications, approvals, rejections
- **Automated Workflows:** Auto-assign applications based on rules
- **Audit Trail:** Complete history of all admin actions with rollback capability
- **Performance Metrics:** Track admin review performance
- **Export Functionality:** Export applications to CSV/Excel
- **Slack Integration:** Notifications for admin team
- **Webhook Support:** Third-party integrations

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building the **core Provider onboarding and application review feature** across the World Camps monorepo. The plan follows established patterns from the existing codebase, maintains consistency with the design system, and ensures a smooth user experience for both providers and superadmins.

**Scope Summary:**

**✅ IN SCOPE (This Epic):**
- Complete provider onboarding flow (Steps 1-5) with frontend and backend
- Google Business Profile integration (search, fetch, save)
- Email verification and account creation
- Document upload and verification
- Trust score calculation and auto-approval logic
- Application submission and status tracking
- Superadmin application review interface
- Approve/reject workflow
- Document verification interface
- Status pages (under review, approved, rejected)
- GoogleBusinessProfile and ProviderSettings models

**❌ OUT OF SCOPE (Future Epics):**
- Stripe Connect backend integration (OAuth, webhooks, API calls)
- Messaging system backend (WebSocket, message sending, real-time features)
- Camp and Session models and management
- Conversation page functionality (placeholder UI only)
- Step 5 Stripe Connect button (placeholder UI only)

**Timeline:** 9 weeks (reduced from 10 weeks)

**Key Success Factors:**
1. Follow the phased approach to ensure steady progress
2. Maintain code quality with comprehensive testing
3. Ensure security and data protection at every step
4. Optimize performance for a smooth user experience
5. Monitor metrics to identify and address issues quickly
6. Keep scope focused on core onboarding and review workflows
7. Use placeholders for future features (Stripe, messaging) to maintain UI consistency

**Next Steps:**
1. Review and approve this implementation plan
2. Set up project tracking (Jira, Linear, etc.)
3. Assign team members to each phase
4. Begin Phase 1: Database & Backend Foundation
5. Plan separate epics for Stripe Connect, Messaging, and Camp/Session management


