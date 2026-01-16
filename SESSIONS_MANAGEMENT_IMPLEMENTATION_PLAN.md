# Sessions Management - Complete Implementation Plan

**Version:** 1.0  
**Date:** 2026-01-16  
**Status:** Ready for Development

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Analysis](#design-analysis)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [Backend API Design](#backend-api-design)
6. [Frontend Implementation](#frontend-implementation)
7. [Integration Strategy](#integration-strategy)
8. [Data Flow & State Management](#data-flow--state-management)
9. [UI/UX Specifications](#uiux-specifications)
10. [Validation & Business Rules](#validation--business-rules)
11. [Edge Cases & Error Handling](#edge-cases--error-handling)
12. [Testing Strategy](#testing-strategy)
13. [Implementation Phases](#implementation-phases)

---

## 1. Executive Summary

### 1.1 Overview

The Sessions Management feature enables camp providers to define and manage booking sessions for their camps. This is a critical component that bridges camp creation and the booking system, allowing parents to select specific dates and durations for their children's camp attendance.

### 1.2 Core Requirements

- **Two Session Types** (mutually exclusive per camp):
  1. **Flexible Dates**: Parents choose start date and duration from available ranges
  2. **Fixed Dates**: Parents book specific predetermined sessions
  
- **Integration Points**:
  - Final step in Camp Creation Wizard (Step 5)
  - "SESSIONS & BOOKINGS" category in Camp Editor
  - Single reusable component for both contexts

### 1.3 Key Features

- Session type selection (one-time choice per camp)
- Full CRUD operations for sessions
- Pricing configuration per session
- Capacity management
- Date range validation
- Auto-save functionality
- Responsive design matching existing patterns

---

## 2. Design Analysis

### 2.1 Design Files Overview

**Location:** `/sessions/` directory

#### Flexible Sessions Designs
- `flex-session-1.png` - Session type selection screen
- `flex-session-2.png` - Flexible session configuration (empty state)
- `flex-session-3.1.png` - Add flexible session modal (step 1)
- `flex-session-3.2.png` - Add flexible session modal (step 2)
- `flex-session-4.1.png` - Flexible session list view
- `flex-session-4.2.png` - Edit flexible session
- `flex-session-4.3.png` - Delete confirmation
- `flex-session-4.4.png` - Multiple flexible sessions

#### Fixed Sessions Designs
- `fixed-session-1.1.png` - Fixed session configuration (empty state)
- `fixed-session-1.2.png` - Fixed session list with multiple sessions

### 2.2 Design Insights & Requirements

#### Session Type Selection Screen (flex-session-1.png)

**UI Elements:**
- Page title: "Sessions"
- Subtitle: "Choose how parents will book your camp"
- Two large selection cards (radio button style):
  - **Flexible Dates Card**
    - Icon: Calendar with flexible arrows
    - Title: "Flexible Dates"
    - Description: "Parents choose their start date and duration"
    - Best for: "Rolling admissions, year-round camps"
  - **Fixed Dates Card**
    - Icon: Calendar with specific dates
    - Title: "Fixed Dates"
    - Description: "Parents book specific predetermined sessions"
    - Best for: "Summer camps, holiday programs"
- Continue button (disabled until selection made)

**Business Rules:**
- This choice is **permanent** once sessions are created
- Cannot switch session types after first session is added
- Must show confirmation dialog if user tries to change type with existing sessions

#### Flexible Sessions Configuration

**Empty State (flex-session-2.png):**
- Illustration: Calendar with plus icon
- Message: "No flexible sessions yet"
- Description: "Create date ranges and durations that parents can choose from"
- Primary CTA: "Add Flexible Session" button

**Add Session Modal - Step 1 (flex-session-3.1.png):**
- Modal title: "Add Flexible Session"
- Step indicator: "Step 1 of 2"
- Fields:
  - **Session Name** (required, max 100 chars)
    - Placeholder: "e.g., Summer 2026, Spring Break"
  - **Available Date Range** (required)
    - Start Date picker
    - End Date picker
    - Validation: End must be after start
  - **Duration Options** (required, multi-select chips)
    - Predefined: 1 week, 2 weeks, 3 weeks, 4 weeks, Custom
    - Custom allows entering number of days (1-365)
    - Must select at least one duration
- Buttons: Cancel, Next

**Add Session Modal - Step 2 (flex-session-3.2.png):**
- Modal title: "Add Flexible Session"
- Step indicator: "Step 2 of 2"
- Fields:
  - **Pricing** (required for each duration)
    - Shows selected durations from Step 1
    - Price input for each duration
    - Currency: USD (or camp's default currency)
  - **Capacity** (optional)
    - Total spots available
    - Checkbox: "Unlimited capacity"
  - **Additional Notes** (optional, max 500 chars)
    - Textarea for special instructions
- Buttons: Back, Cancel, Create Session

**Session List View (flex-session-4.1, 4.4):**
- Card-based layout for each session
- Each card shows:
  - Session name (editable inline or via edit button)
  - Date range badge
  - Duration chips with prices
  - Capacity indicator (e.g., "50 spots" or "Unlimited")
  - Status badge (Active/Inactive)
  - Action buttons: Edit, Delete, Toggle Active
- Empty slots show "Add Flexible Session" card
- Maximum 10 flexible sessions per camp

**Edit Session (flex-session-4.2):**
- Same modal as Add, pre-filled with existing data
- Warning if editing affects existing bookings
- Cannot change dates if bookings exist in that range

**Delete Confirmation (flex-session-4.3):**
- Modal title: "Delete Session?"
- Warning message: "This will permanently delete [Session Name]"
- Impact notice: "X bookings will be affected" (if any)
- Buttons: Cancel, Delete (danger color)

#### Fixed Sessions Configuration

**Empty State (fixed-session-1.1):**
- Similar to flexible empty state
- Message: "No fixed sessions yet"
- Description: "Create specific camp sessions with set start and end dates"
- Primary CTA: "Add Fixed Session" button

**Session List View (fixed-session-1.2):**
- Table/card layout showing:
  - Session name
  - Start date - End date
  - Duration (auto-calculated, e.g., "2 weeks")
  - Price
  - Capacity (booked/total)
  - Status (Active/Inactive/Full)
  - Actions: Edit, Duplicate, Delete
- Sortable by start date
- Color coding for status:
  - Green: Active with availability
  - Yellow: Nearly full (>80% capacity)
  - Red: Full
  - Gray: Inactive or past dates

### 2.3 Missing Elements & Improvements

**Identified Gaps:**
1. No bulk operations (e.g., duplicate session, bulk activate/deactivate)
2. No session templates for recurring camps
3. No waitlist management UI
4. No early bird pricing or discounts per session
5. No minimum/maximum age restrictions per session
6. No session-specific add-ons

**Recommended Additions:**
1. **Duplicate Session** button for quick creation of similar sessions
2. **Session Templates** for camps that run annually
3. **Waitlist Toggle** per session
4. **Early Bird Pricing** with cutoff date
5. **Age Restrictions** override at session level
6. **Blackout Dates** for flexible sessions (dates when camp is closed)

---

## 3. Technical Architecture

### 3.1 Component Structure

```
sessions/
├── SessionsPage.tsx                    # Main container (Wizard Step 5 & Editor)
├── components/
│   ├── SessionTypeSelector.tsx        # Initial type selection
│   ├── FlexibleSessions/
│   │   ├── FlexibleSessionsList.tsx   # List view with cards
│   │   ├── FlexibleSessionCard.tsx    # Individual session card
│   │   ├── AddFlexibleSessionModal.tsx # Multi-step modal
│   │   ├── FlexibleSessionForm.tsx    # Form logic (Step 1 & 2)
│   │   └── FlexibleSessionEmpty.tsx   # Empty state
│   ├── FixedSessions/
│   │   ├── FixedSessionsList.tsx      # Table/card view
│   │   ├── FixedSessionRow.tsx        # Individual session row
│   │   ├── AddFixedSessionModal.tsx   # Single-step modal
│   │   ├── FixedSessionForm.tsx       # Form logic
│   │   └── FixedSessionEmpty.tsx      # Empty state
│   └── shared/
│       ├── SessionStatusBadge.tsx     # Status indicator
│       ├── SessionCapacityIndicator.tsx
│       ├── SessionPricingDisplay.tsx
│       ├── DeleteSessionDialog.tsx    # Confirmation dialog
│       └── SessionValidationMessages.tsx
├── hooks/
│   ├── useSessionsData.tsx            # Data fetching & caching
│   ├── useSessionMutations.tsx        # CRUD operations
│   └── useSessionValidation.tsx       # Validation logic
├── types/
│   └── sessions.types.ts              # TypeScript interfaces
└── utils/
    ├── sessionValidators.ts           # Validation functions
    ├── sessionCalculations.ts         # Price, duration calculations
    └── sessionFormatters.ts           # Date, currency formatting
```

### 3.2 State Management

**Zustand Store Extension:**

```typescript
// stores/sessions-store.ts
interface SessionsState {
  // Data
  sessions: Session[]
  sessionType: 'flexible' | 'fixed' | null

  // UI State
  isLoading: boolean
  isSaving: boolean
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error'
  hasPendingAutoSave: boolean

  // Modal State
  isAddModalOpen: boolean
  isEditModalOpen: boolean
  isDeleteDialogOpen: boolean
  selectedSession: Session | null

  // Actions
  setSessions: (sessions: Session[]) => void
  setSessionType: (type: 'flexible' | 'fixed') => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  toggleSessionStatus: (id: string) => void

  // Modal Actions
  openAddModal: () => void
  closeAddModal: () => void
  openEditModal: (session: Session) => void
  closeEditModal: () => void
  openDeleteDialog: (session: Session) => void
  closeDeleteDialog: () => void
}
```

**Integration with Camps Store:**

```typescript
// stores/camps-store.ts - Add sessions-related fields
interface CampsState {
  // ... existing fields

  // Sessions
  sessionType: 'flexible' | 'fixed' | null
  sessions: Session[]

  // ... existing actions
}
```

### 3.3 Data Flow

```
User Action → Component → Hook → API Service → Backend → Database
                ↓                                    ↓
            Local State ← Response ← API Response ←─┘
                ↓
         Zustand Store
                ↓
         UI Update
```

**Auto-Save Flow:**
1. User modifies session data
2. Component triggers debounced save (1.5s delay)
3. Store sets `hasPendingAutoSave: true`
4. API call initiated
5. On success: Store sets `autoSaveStatus: 'saved'`
6. After 2s: Reset to `idle`
7. Footer shows "Changes are saved automatically"

---

## 4. Database Schema

### 4.1 Prisma Schema Updates

```prisma
// schema.prisma

model Camp {
  id         String @id @default(uuid())
  providerId String @map("provider_id")

  // ... existing fields

  // Sessions
  sessionType SessionType? @map("session_type")
  sessions    Session[]

  // ... rest of fields
}

enum SessionType {
  flexible
  fixed
}

model Session {
  id     String      @id @default(uuid())
  campId String      @map("camp_id")
  type   SessionType

  // Common Fields
  name        String   @db.VarChar(100)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  capacity    Int?     // null = unlimited

  // Flexible Session Fields
  startDate      DateTime? @map("start_date") @db.Date
  endDate        DateTime? @map("end_date") @db.Date
  durations      Json?     // [{weeks: 1, price: 500}, {weeks: 2, price: 900}]
  blackoutDates  Json?     @map("blackout_dates") // [{start: '2026-07-04', end: '2026-07-04'}]

  // Fixed Session Fields
  sessionStartDate DateTime? @map("session_start_date") @db.Date
  sessionEndDate   DateTime? @map("session_end_date") @db.Date
  price            Decimal?  @db.Decimal(10, 2)

  // Metadata
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  camp     Camp      @relation(fields: [campId], references: [id], onDelete: Cascade)
  bookings Booking[]

  @@index([campId])
  @@index([type])
  @@index([isActive])
  @@index([startDate, endDate])
  @@map("sessions")
}

model Booking {
  id        String   @id @default(uuid())
  sessionId String   @map("session_id")
  parentId  String   @map("parent_id")
  childId   String   @map("child_id")

  // Booking Details
  startDate    DateTime @map("start_date") @db.Date
  endDate      DateTime @map("end_date") @db.Date
  duration     Int      // days
  totalPrice   Decimal  @map("total_price") @db.Decimal(10, 2)
  status       BookingStatus

  // Payment
  paymentStatus PaymentStatus @default(pending) @map("payment_status")
  paidAmount    Decimal       @default(0) @map("paid_amount") @db.Decimal(10, 2)

  // Metadata
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  session Session  @relation(fields: [sessionId], references: [id], onDelete: Restrict)
  parent  Parent   @relation(fields: [parentId], references: [id], onDelete: Restrict)
  child   Children @relation(fields: [childId], references: [id], onDelete: Restrict)

  @@index([sessionId])
  @@index([parentId])
  @@index([childId])
  @@index([status])
  @@map("bookings")
}

enum BookingStatus {
  pending
  confirmed
  cancelled
  completed
}

enum PaymentStatus {
  pending
  partial
  paid
  refunded
}
```

### 4.2 Migration Strategy

**Migration File:** `20260116_add_sessions.sql`

```sql
-- Create enums
CREATE TYPE "SessionType" AS ENUM ('flexible', 'fixed');
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partial', 'paid', 'refunded');

-- Add session_type to camps table
ALTER TABLE "camps" ADD COLUMN "session_type" "SessionType";

-- Create sessions table
CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "camp_id" TEXT NOT NULL,
  "type" "SessionType" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "capacity" INTEGER,
  "start_date" DATE,
  "end_date" DATE,
  "durations" JSONB,
  "blackout_dates" JSONB,
  "session_start_date" DATE,
  "session_end_date" DATE,
  "price" DECIMAL(10,2),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Create bookings table
CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "parent_id" TEXT NOT NULL,
  "child_id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "duration" INTEGER NOT NULL,
  "total_price" DECIMAL(10,2) NOT NULL,
  "status" "BookingStatus" NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_camp_id_fkey"
  FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "sessions_camp_id_idx" ON "sessions"("camp_id");
CREATE INDEX "sessions_type_idx" ON "sessions"("type");
CREATE INDEX "sessions_is_active_idx" ON "sessions"("is_active");
CREATE INDEX "sessions_start_date_end_date_idx" ON "sessions"("start_date", "end_date");

CREATE INDEX "bookings_session_id_idx" ON "bookings"("session_id");
CREATE INDEX "bookings_parent_id_idx" ON "bookings"("parent_id");
CREATE INDEX "bookings_child_id_idx" ON "bookings"("child_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
```

---

## 5. Backend API Design

### 5.1 API Endpoints

**Base URL:** `/provider/camps/:campId/sessions`

#### Session Type Management

```typescript
// GET /provider/camps/:campId/session-type
// Get current session type for camp
Response: {
  sessionType: 'flexible' | 'fixed' | null
  canChange: boolean  // false if sessions exist
}

// PATCH /provider/camps/:campId/session-type
// Set session type (only if no sessions exist)
Request: {
  sessionType: 'flexible' | 'fixed'
}
Response: {
  sessionType: 'flexible' | 'fixed'
  message: string
}
```

#### Flexible Sessions

```typescript
// GET /provider/camps/:campId/sessions/flexible
// Get all flexible sessions for camp
Response: {
  sessions: FlexibleSession[]
  total: number
}

// POST /provider/camps/:campId/sessions/flexible
// Create new flexible session
Request: {
  name: string
  description?: string
  startDate: string  // ISO date
  endDate: string
  durations: Array<{
    weeks: number
    days?: number  // for custom durations
    price: number
  }>
  capacity?: number
  blackoutDates?: Array<{
    start: string
    end: string
    reason?: string
  }>
}
Response: {
  session: FlexibleSession
  message: string
}

// PATCH /provider/camps/:campId/sessions/flexible/:sessionId
// Update flexible session
Request: Partial<CreateFlexibleSessionDto>
Response: {
  session: FlexibleSession
  message: string
}

// DELETE /provider/camps/:campId/sessions/flexible/:sessionId
// Delete flexible session
Response: {
  message: string
  affectedBookings: number
}

// PATCH /provider/camps/:campId/sessions/flexible/:sessionId/toggle
// Toggle session active status
Response: {
  session: FlexibleSession
  message: string
}
```

#### Fixed Sessions

```typescript
// GET /provider/camps/:campId/sessions/fixed
// Get all fixed sessions for camp
Response: {
  sessions: FixedSession[]
  total: number
}

// POST /provider/camps/:campId/sessions/fixed
// Create new fixed session
Request: {
  name: string
  description?: string
  sessionStartDate: string  // ISO date
  sessionEndDate: string
  price: number
  capacity?: number
}
Response: {
  session: FixedSession
  message: string
}

// PATCH /provider/camps/:campId/sessions/fixed/:sessionId
// Update fixed session
Request: Partial<CreateFixedSessionDto>
Response: {
  session: FixedSession
  message: string
}

// DELETE /provider/camps/:campId/sessions/fixed/:sessionId
// Delete fixed session
Response: {
  message: string
  affectedBookings: number
}

// POST /provider/camps/:campId/sessions/fixed/:sessionId/duplicate
// Duplicate a fixed session
Response: {
  session: FixedSession
  message: string
}
```

#### Bulk Operations

```typescript
// PATCH /provider/camps/:campId/sessions/reorder
// Reorder sessions
Request: {
  sessionIds: string[]  // ordered array of session IDs
}
Response: {
  message: string
}

// PATCH /provider/camps/:campId/sessions/bulk-toggle
// Bulk activate/deactivate sessions
Request: {
  sessionIds: string[]
  isActive: boolean
}
Response: {
  updated: number
  message: string
}
```

### 5.2 DTOs (Data Transfer Objects)

```typescript
// dto/create-flexible-session.dto.ts
import { IsString, IsNotEmpty, IsDateString, IsArray, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class DurationDto {
  @IsNumber()
  @Min(1)
  @Max(52)
  weeks: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number

  @IsNumber()
  @Min(0)
  price: number
}

class BlackoutDateDto {
  @IsDateString()
  start: string

  @IsDateString()
  end: string

  @IsOptional()
  @IsString()
  reason?: string
}

export class CreateFlexibleSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  startDate: string

  @IsDateString()
  endDate: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationDto)
  durations: DurationDto[]

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlackoutDateDto)
  blackoutDates?: BlackoutDateDto[]
}

// dto/create-fixed-session.dto.ts
export class CreateFixedSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsDateString()
  sessionStartDate: string

  @IsDateString()
  sessionEndDate: string

  @IsNumber()
  @Min(0)
  price: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number
}

// dto/update-session-type.dto.ts
export class UpdateSessionTypeDto {
  @IsEnum(['flexible', 'fixed'])
  sessionType: 'flexible' | 'fixed'
}
```

### 5.3 Service Layer

```typescript
// sessions.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  // Session Type Management
  async getSessionType(campId: string, providerId: string) {
    const camp = await this.validateCampOwnership(campId, providerId)
    const sessionsCount = await this.prisma.session.count({
      where: { campId }
    })

    return {
      sessionType: camp.sessionType,
      canChange: sessionsCount === 0
    }
  }

  async setSessionType(campId: string, providerId: string, sessionType: 'flexible' | 'fixed') {
    const camp = await this.validateCampOwnership(campId, providerId)

    // Check if sessions already exist
    const sessionsCount = await this.prisma.session.count({
      where: { campId }
    })

    if (sessionsCount > 0 && camp.sessionType !== sessionType) {
      throw new BadRequestException(
        'Cannot change session type when sessions already exist. Delete all sessions first.'
      )
    }

    const updated = await this.prisma.camp.update({
      where: { id: campId },
      data: { sessionType }
    })

    return {
      sessionType: updated.sessionType,
      message: 'Session type updated successfully'
    }
  }

  // Flexible Sessions
  async createFlexibleSession(campId: string, providerId: string, dto: CreateFlexibleSessionDto) {
    await this.validateCampOwnership(campId, providerId)
    await this.validateSessionType(campId, 'flexible')

    // Validate dates
    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date')
    }

    // Validate durations
    if (!dto.durations || dto.durations.length === 0) {
      throw new BadRequestException('At least one duration is required')
    }

    // Get next sort order
    const maxSortOrder = await this.prisma.session.aggregate({
      where: { campId },
      _max: { sortOrder: true }
    })

    const session = await this.prisma.session.create({
      data: {
        campId,
        type: 'flexible',
        name: dto.name,
        description: dto.description,
        startDate,
        endDate,
        durations: dto.durations,
        capacity: dto.capacity,
        blackoutDates: dto.blackoutDates,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1
      }
    })

    return {
      session,
      message: 'Flexible session created successfully'
    }
  }

  async updateFlexibleSession(
    campId: string,
    sessionId: string,
    providerId: string,
    dto: Partial<CreateFlexibleSessionDto>
  ) {
    await this.validateCampOwnership(campId, providerId)
    await this.validateSessionOwnership(sessionId, campId)

    // Check if there are bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId }
    })

    // If there are bookings, restrict certain changes
    if (bookingsCount > 0) {
      if (dto.startDate || dto.endDate) {
        throw new BadRequestException(
          'Cannot change dates for sessions with existing bookings'
        )
      }
    }

    const updateData: any = {}
    if (dto.name) updateData.name = dto.name
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.startDate) updateData.startDate = new Date(dto.startDate)
    if (dto.endDate) updateData.endDate = new Date(dto.endDate)
    if (dto.durations) updateData.durations = dto.durations
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity
    if (dto.blackoutDates !== undefined) updateData.blackoutDates = dto.blackoutDates

    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: updateData
    })

    return {
      session,
      message: 'Session updated successfully'
    }
  }

  async deleteSession(campId: string, sessionId: string, providerId: string) {
    await this.validateCampOwnership(campId, providerId)
    await this.validateSessionOwnership(sessionId, campId)

    // Check for bookings
    const bookingsCount = await this.prisma.booking.count({
      where: { sessionId }
    })

    if (bookingsCount > 0) {
      throw new BadRequestException(
        `Cannot delete session with ${bookingsCount} existing booking(s). Cancel bookings first.`
      )
    }

    await this.prisma.session.delete({
      where: { id: sessionId }
    })

    return {
      message: 'Session deleted successfully',
      affectedBookings: 0
    }
  }

  // Helper methods
  private async validateCampOwnership(campId: string, providerId: string) {
    const camp = await this.prisma.camp.findFirst({
      where: { id: campId, providerId }
    })

    if (!camp) {
      throw new NotFoundException('Camp not found or access denied')
    }

    return camp
  }

  private async validateSessionType(campId: string, expectedType: 'flexible' | 'fixed') {
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId }
    })

    if (camp.sessionType && camp.sessionType !== expectedType) {
      throw new BadRequestException(
        `This camp uses ${camp.sessionType} sessions. Cannot create ${expectedType} sessions.`
      )
    }
  }

  private async validateSessionOwnership(sessionId: string, campId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, campId }
    })

    if (!session) {
      throw new NotFoundException('Session not found')
    }

    return session
  }
}
```

---

## 6. Frontend Implementation

### 6.1 TypeScript Types

```typescript
// types/sessions.types.ts

export type SessionType = 'flexible' | 'fixed'

export interface BaseDuration {
  weeks: number
  days?: number
  price: number
}

export interface BlackoutDate {
  start: string  // ISO date
  end: string
  reason?: string
}

export interface BaseSession {
  id: string
  campId: string
  type: SessionType
  name: string
  description?: string
  isActive: boolean
  capacity?: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FlexibleSession extends BaseSession {
  type: 'flexible'
  startDate: string  // ISO date
  endDate: string
  durations: BaseDuration[]
  blackoutDates?: BlackoutDate[]
}

export interface FixedSession extends BaseSession {
  type: 'fixed'
  sessionStartDate: string
  sessionEndDate: string
  price: number
  bookedCount?: number  // from bookings relation
}

export type Session = FlexibleSession | FixedSession

// Form Data Types
export interface FlexibleSessionFormData {
  name: string
  description: string
  startDate: Date | null
  endDate: Date | null
  durations: Array<{
    weeks: number
    days?: number
    price: string  // string for input, converted to number on submit
  }>
  capacity: string
  hasUnlimitedCapacity: boolean
  blackoutDates: Array<{
    start: Date | null
    end: Date | null
    reason: string
  }>
}

export interface FixedSessionFormData {
  name: string
  description: string
  sessionStartDate: Date | null
  sessionEndDate: Date | null
  price: string
  capacity: string
  hasUnlimitedCapacity: boolean
}

// API Response Types
export interface SessionTypeResponse {
  sessionType: SessionType | null
  canChange: boolean
}

export interface SessionsListResponse {
  sessions: Session[]
  total: number
}

export interface SessionResponse {
  session: Session
  message: string
}

export interface DeleteSessionResponse {
  message: string
  affectedBookings: number
}
```

### 6.2 API Service

```typescript
// services/sessions.service.ts
import apiClient from '@/utils/api-client'
import type {
  SessionType,
  Session,
  FlexibleSession,
  FixedSession,
  SessionTypeResponse,
  SessionsListResponse,
  SessionResponse,
  DeleteSessionResponse,
  FlexibleSessionFormData,
  FixedSessionFormData
} from '@/types/sessions.types'

const BASE_URL = '/provider/camps'

// Session Type
export async function getSessionType(campId: string): Promise<SessionTypeResponse> {
  const response = await apiClient.get<SessionTypeResponse>(
    `${BASE_URL}/${campId}/session-type`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionTypeResponse
}

export async function setSessionType(
  campId: string,
  sessionType: SessionType
): Promise<{ sessionType: SessionType; message: string }> {
  const response = await apiClient.patch(`${BASE_URL}/${campId}/session-type`, {
    sessionType
  })
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as { sessionType: SessionType; message: string }
}

// Flexible Sessions
export async function getFlexibleSessions(campId: string): Promise<SessionsListResponse> {
  const response = await apiClient.get<SessionsListResponse>(
    `${BASE_URL}/${campId}/sessions/flexible`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionsListResponse
}

export async function createFlexibleSession(
  campId: string,
  data: FlexibleSessionFormData
): Promise<SessionResponse> {
  const payload = {
    name: data.name,
    description: data.description || undefined,
    startDate: data.startDate?.toISOString(),
    endDate: data.endDate?.toISOString(),
    durations: data.durations.map(d => ({
      weeks: d.weeks,
      days: d.days,
      price: parseFloat(d.price)
    })),
    capacity: data.hasUnlimitedCapacity ? undefined : parseInt(data.capacity),
    blackoutDates: data.blackoutDates.length > 0 ? data.blackoutDates.map(bd => ({
      start: bd.start?.toISOString(),
      end: bd.end?.toISOString(),
      reason: bd.reason || undefined
    })) : undefined
  }

  const response = await apiClient.post(`${BASE_URL}/${campId}/sessions/flexible`, payload)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

export async function updateFlexibleSession(
  campId: string,
  sessionId: string,
  data: Partial<FlexibleSessionFormData>
): Promise<SessionResponse> {
  const payload: any = {}

  if (data.name) payload.name = data.name
  if (data.description !== undefined) payload.description = data.description || undefined
  if (data.startDate) payload.startDate = data.startDate.toISOString()
  if (data.endDate) payload.endDate = data.endDate.toISOString()
  if (data.durations) {
    payload.durations = data.durations.map(d => ({
      weeks: d.weeks,
      days: d.days,
      price: parseFloat(d.price)
    }))
  }
  if (data.hasUnlimitedCapacity !== undefined) {
    payload.capacity = data.hasUnlimitedCapacity ? undefined : parseInt(data.capacity || '0')
  }
  if (data.blackoutDates) {
    payload.blackoutDates = data.blackoutDates.map(bd => ({
      start: bd.start?.toISOString(),
      end: bd.end?.toISOString(),
      reason: bd.reason || undefined
    }))
  }

  const response = await apiClient.patch(
    `${BASE_URL}/${campId}/sessions/flexible/${sessionId}`,
    payload
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

export async function deleteSession(
  campId: string,
  sessionId: string
): Promise<DeleteSessionResponse> {
  const response = await apiClient.delete<DeleteSessionResponse>(
    `${BASE_URL}/${campId}/sessions/flexible/${sessionId}`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as DeleteSessionResponse
}

export async function toggleSessionStatus(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.patch(
    `${BASE_URL}/${campId}/sessions/flexible/${sessionId}/toggle`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

// Fixed Sessions (similar pattern)
export async function getFixedSessions(campId: string): Promise<SessionsListResponse> {
  const response = await apiClient.get<SessionsListResponse>(
    `${BASE_URL}/${campId}/sessions/fixed`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionsListResponse
}

export async function createFixedSession(
  campId: string,
  data: FixedSessionFormData
): Promise<SessionResponse> {
  const payload = {
    name: data.name,
    description: data.description || undefined,
    sessionStartDate: data.sessionStartDate?.toISOString(),
    sessionEndDate: data.sessionEndDate?.toISOString(),
    price: parseFloat(data.price),
    capacity: data.hasUnlimitedCapacity ? undefined : parseInt(data.capacity)
  }

  const response = await apiClient.post(`${BASE_URL}/${campId}/sessions/fixed`, payload)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

export async function duplicateFixedSession(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.post(
    `${BASE_URL}/${campId}/sessions/fixed/${sessionId}/duplicate`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}
```

### 6.3 Custom Hooks

```typescript
// hooks/useSessionsData.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import * as sessionsService from '@/services/sessions.service'
import type { Session, SessionType } from '@/types/sessions.types'

export function useSessionsData() {
  const params = useParams()
  const campId = params.id as string

  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [canChangeType, setCanChangeType] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessionData()
  }, [campId])

  const loadSessionData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load session type
      const typeResponse = await sessionsService.getSessionType(campId)
      setSessionType(typeResponse.sessionType)
      setCanChangeType(typeResponse.canChange)

      // Load sessions if type is set
      if (typeResponse.sessionType) {
        const sessionsResponse = typeResponse.sessionType === 'flexible'
          ? await sessionsService.getFlexibleSessions(campId)
          : await sessionsService.getFixedSessions(campId)

        setSessions(sessionsResponse.sessions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    campId,
    sessionType,
    canChangeType,
    sessions,
    isLoading,
    error,
    reload: loadSessionData
  }
}

// hooks/useSessionMutations.tsx
import { useState } from 'react'
import { useCampsStore } from '@/stores/camps-store'
import * as sessionsService from '@/services/sessions.service'
import type {
  SessionType,
  FlexibleSessionFormData,
  FixedSessionFormData
} from '@/types/sessions.types'

export function useSessionMutations(campId: string, onSuccess?: () => void) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSessionType = async (type: SessionType) => {
    try {
      setIsSaving(true)
      setError(null)
      await sessionsService.setSessionType(campId, type)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set session type')
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const createFlexibleSession = async (data: FlexibleSessionFormData) => {
    try {
      setIsSaving(true)
      setError(null)
      await sessionsService.createFlexibleSession(campId, data)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const updateFlexibleSession = async (
    sessionId: string,
    data: Partial<FlexibleSessionFormData>
  ) => {
    try {
      setIsSaving(true)
      setError(null)
      await sessionsService.updateFlexibleSession(campId, sessionId, data)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session')
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      setIsSaving(true)
      setError(null)
      await sessionsService.deleteSession(campId, sessionId)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
      throw err
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSessionStatus = async (sessionId: string) => {
    try {
      setError(null)
      await sessionsService.toggleSessionStatus(campId, sessionId)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle session status')
      throw err
    }
  }

  return {
    isSaving,
    error,
    setSessionType,
    createFlexibleSession,
    updateFlexibleSession,
    deleteSession,
    toggleSessionStatus
  }
}
```

### 6.4 Main Sessions Page Component

```typescript
// app/camps/[id]/edit/sessions/page.tsx
'use client'

import { useEffect } from 'react'
import { useSessionsData } from '@/hooks/useSessionsData'
import { useCampsStore } from '@/stores/camps-store'
import { SessionTypeSelector } from '@/components/sessions/SessionTypeSelector'
import { FlexibleSessionsList } from '@/components/sessions/FlexibleSessions/FlexibleSessionsList'
import { FixedSessionsList } from '@/components/sessions/FixedSessions/FixedSessionsList'
import { Spinner } from '@heroui/react'

export default function SessionsPage() {
  const {
    campId,
    sessionType,
    canChangeType,
    sessions,
    isLoading,
    error,
    reload
  } = useSessionsData()

  // Clear auto-save state on unmount
  useEffect(() => {
    return () => {
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-6">
        <p className="text-danger-600">{error}</p>
      </div>
    )
  }

  // Show session type selector if no type is set
  if (!sessionType) {
    return <SessionTypeSelector campId={campId} onTypeSelected={reload} />
  }

  // Show appropriate sessions list based on type
  return (
    <div className="space-y-6">
      {sessionType === 'flexible' ? (
        <FlexibleSessionsList
          campId={campId}
          sessions={sessions as FlexibleSession[]}
          onUpdate={reload}
        />
      ) : (
        <FixedSessionsList
          campId={campId}
          sessions={sessions as FixedSession[]}
          onUpdate={reload}
        />
      )}
    </div>
  )
}
```

### 6.5 Session Type Selector Component

```typescript
// components/sessions/SessionTypeSelector.tsx
'use client'

import { useState } from 'react'
import { Button, Card, CardBody } from '@heroui/react'
import { useSessionMutations } from '@/hooks/useSessionMutations'
import type { SessionType } from '@/types/sessions.types'

interface SessionTypeSelectorProps {
  campId: string
  onTypeSelected: () => void
}

export function SessionTypeSelector({ campId, onTypeSelected }: SessionTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<SessionType | null>(null)
  const { setSessionType, isSaving } = useSessionMutations(campId, onTypeSelected)

  const handleContinue = async () => {
    if (!selectedType) return

    try {
      await setSessionType(selectedType)
    } catch (error) {
      console.error('Failed to set session type:', error)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
        <p className="mt-2 text-lg text-default-600">
          Choose how parents will book your camp
        </p>
      </div>

      {/* Selection Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Flexible Dates Card */}
        <Card
          isPressable
          isHoverable
          onPress={() => setSelectedType('flexible')}
          className={`cursor-pointer transition-all ${
            selectedType === 'flexible'
              ? 'border-2 border-primary bg-primary-50'
              : 'border-2 border-transparent hover:border-default-300'
          }`}
        >
          <CardBody className="p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <span className="text-3xl">📅</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Flexible Dates</h3>
            <p className="mb-4 text-default-600">
              Parents choose their start date and duration
            </p>
            <div className="rounded-lg bg-default-100 p-3">
              <p className="text-sm font-medium text-default-700">Best for:</p>
              <p className="text-sm text-default-600">
                Rolling admissions, year-round camps
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Fixed Dates Card */}
        <Card
          isPressable
          isHoverable
          onPress={() => setSelectedType('fixed')}
          className={`cursor-pointer transition-all ${
            selectedType === 'fixed'
              ? 'border-2 border-primary bg-primary-50'
              : 'border-2 border-transparent hover:border-default-300'
          }`}
        >
          <CardBody className="p-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100">
              <span className="text-3xl">🗓️</span>
            </div>
            <h3 className="mb-2 text-xl font-semibold">Fixed Dates</h3>
            <p className="mb-4 text-default-600">
              Parents book specific predetermined sessions
            </p>
            <div className="rounded-lg bg-default-100 p-3">
              <p className="text-sm font-medium text-default-700">Best for:</p>
              <p className="text-sm text-default-600">
                Summer camps, holiday programs
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Continue Button */}
      <div className="flex justify-center">
        <Button
          color="primary"
          size="lg"
          isDisabled={!selectedType || isSaving}
          isLoading={isSaving}
          onPress={handleContinue}
        >
          Continue
        </Button>
      </div>

      {/* Info Notice */}
      <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
        <p className="text-sm text-warning-800">
          <strong>Note:</strong> This choice is permanent once you create your first session.
          Choose carefully based on your camp's booking model.
        </p>
      </div>
    </div>
  )
}
```

---

## 7. Integration Strategy

### 7.1 Camp Creation Wizard Integration

**Step 5 Addition:**

```typescript
// components/camps/CampWizardSidebar.tsx
const WIZARD_STEPS = [
  { number: 1, title: 'Basic Info', subtitle: 'Camp details', path: 'basic-info' },
  { number: 2, title: 'Audience', subtitle: 'Target campers', path: 'audience' },
  { number: 3, title: 'Programs', subtitle: 'Activities', path: 'programs' },
  { number: 4, title: 'Photos', subtitle: 'Gallery', path: 'photos' },
  { number: 5, title: 'Sessions', subtitle: 'Booking setup', path: 'sessions' }, // NEW
]

// components/camps/CampWizardFooter.tsx
const STEP_PATHS: Record<number, string> = {
  1: 'basic-info',
  2: 'audience',
  3: 'programs',
  4: 'photos',
  5: 'sessions', // NEW
}

// Update handleNext logic for step 4
const handleNext = async () => {
  if (wizardFormSubmit) {
    await wizardFormSubmit()
  } else if (currentStep < 5 && campId) { // Changed from 4 to 5
    const nextStep = currentStep + 1
    router.push(`/camps/create/${STEP_PATHS[nextStep]}?id=${campId}`)
  }
}

// Update step 5 footer to show "Publish Camp" or "Save as Draft"
{currentStep === 5 && (
  <div className="flex gap-3">
    <Button
      variant="bordered"
      size="lg"
      onPress={handleSaveDraft}
      isDisabled={isSaving}
    >
      Save as Draft
    </Button>
    <Button
      color="primary"
      size="lg"
      onPress={handlePublish}
      isDisabled={!canPublish || isSaving}
      isLoading={isSaving}
    >
      Publish Camp
    </Button>
  </div>
)}
```

**Wizard Page:**

```typescript
// app/camps/create/sessions/page.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCampsStore } from '@/stores/camps-store'
import SessionsPage from '../../[id]/edit/sessions/page'

export default function WizardSessionsPage() {
  const searchParams = useSearchParams()
  const campId = searchParams.get('id')
  const { setWizardStep } = useCampsStore()

  useEffect(() => {
    setWizardStep(5)
  }, [setWizardStep])

  if (!campId) {
    return <div>Invalid camp ID</div>
  }

  // Reuse the same SessionsPage component
  return <SessionsPage />
}
```

### 7.2 Camp Editor Integration

**Sidebar Update:**

```typescript
// components/camps/CampEditorSidebar.tsx
const editorSections: EditorSection[] = [
  // ... existing sections

  // SESSIONS & BOOKING
  {
    id: 'sessions',
    label: 'Sessions',
    path: 'sessions',
    category: 'SESSIONS & BOOKING',
  },
  {
    id: 'whats-included',
    label: "What's Included",
    path: 'whats-included',
    category: 'SESSIONS & BOOKING',
  },
  { id: 'addons', label: 'Optional Add-ons', path: 'addons', category: 'SESSIONS & BOOKING' },

  // ... rest of sections
]
```

**Footer Update:**

```typescript
// components/camps/CampEditorFooter.tsx
const editorSections = [
  'basic-info',
  'audience',
  'programs',
  'photos',
  'sessions', // NEW - add to navigation order
  'whats-included',
  'addons',
  // ... rest
]

// Add to auto-save sections (sessions will use auto-save)
const autoSaveOnlySections = [
  'sessions', // NEW
  'whats-included',
  'addons',
  // ... rest
]
```

### 7.3 Validation Rules

**Camp Publishing Requirements:**

```typescript
// utils/campValidation.ts
export function canPublishCamp(camp: Camp): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Existing validations
  if (!camp.name) errors.push('Camp name is required')
  if (!camp.description) errors.push('Camp description is required')
  // ... other validations

  // NEW: Sessions validation
  if (!camp.sessionType) {
    errors.push('You must set up at least one session before publishing')
  }

  // Check if at least one active session exists
  const activeSessions = await prisma.session.count({
    where: {
      campId: camp.id,
      isActive: true
    }
  })

  if (activeSessions === 0) {
    errors.push('You must have at least one active session before publishing')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

## 8. Data Flow & State Management

### 8.1 State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interaction                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  React Component                             │
│  - SessionTypeSelector                                       │
│  - FlexibleSessionsList                                      │
│  - AddFlexibleSessionModal                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Custom Hooks                               │
│  - useSessionsData (fetch & cache)                           │
│  - useSessionMutations (CRUD operations)                     │
│  - useSessionValidation (form validation)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Service Layer                           │
│  - sessions.service.ts                                       │
│  - Handles HTTP requests                                     │
│  - Transforms data for API                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (NestJS)                        │
│  - SessionsController                                        │
│  - SessionsService                                           │
│  - Validation (DTOs)                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database (PostgreSQL)                       │
│  - camps table (sessionType)                                 │
│  - sessions table                                            │
│  - bookings table                                            │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Auto-Save Implementation

**Pattern (matching existing auto-save pages):**

```typescript
// In any session component that modifies data
const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

// Cleanup on unmount
useEffect(() => {
  return () => {
    useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'idle' })
  }
}, [])

// Auto-save handler
const triggerAutoSave = (updatedData: Session) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  setAutoSaveStatus('saving')
  useCampsStore.setState({ hasPendingAutoSave: true, autoSaveStatus: 'saving' })

  const timeout = setTimeout(async () => {
    try {
      await updateSession(campId, updatedData.id, updatedData)
      setAutoSaveStatus('saved')
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'saved' })

      setTimeout(() => {
        setAutoSaveStatus('idle')
        useCampsStore.setState({ autoSaveStatus: 'idle' })
      }, 2000)
    } catch (error) {
      console.error('Failed to save session:', error)
      setAutoSaveStatus('error')
      useCampsStore.setState({ hasPendingAutoSave: false, autoSaveStatus: 'error' })
    }
  }, 1500)

  setSaveTimeout(timeout)
}
```

---

## 9. UI/UX Specifications

### 9.1 Responsive Design

**Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Mobile Adaptations:**
- Session cards stack vertically
- Modal becomes full-screen
- Table view switches to card view for fixed sessions
- Reduced padding and font sizes
- Sticky action buttons at bottom

### 9.2 Color Scheme & Styling

**Status Colors:**
```typescript
const statusColors = {
  active: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    border: 'border-success-200'
  },
  inactive: {
    bg: 'bg-default-100',
    text: 'text-default-600',
    border: 'border-default-200'
  },
  full: {
    bg: 'bg-danger-50',
    text: 'text-danger-700',
    border: 'border-danger-200'
  },
  nearlyFull: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    border: 'border-warning-200'
  }
}
```

**Component Styling (HeroUI):**
- Buttons: `color="primary"` for primary actions
- Cards: `isHoverable` for interactive cards
- Inputs: `variant="bordered"` for consistency
- Modals: `size="2xl"` for forms
- Badges: `variant="flat"` for status indicators

### 9.3 Accessibility

**ARIA Labels:**
```typescript
<Button
  aria-label="Add new flexible session"
  aria-describedby="session-help-text"
>
  Add Session
</Button>

<Card
  role="button"
  tabIndex={0}
  aria-pressed={isSelected}
  onKeyDown={(e) => e.key === 'Enter' && handleSelect()}
>
  Session Card
</Card>
```

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter/Space to activate buttons and cards
- Escape to close modals
- Arrow keys for date pickers

**Screen Reader Support:**
- Descriptive labels for all form fields
- Status announcements for auto-save
- Error messages linked to form fields
- Loading states announced

### 9.4 Loading States

**Skeleton Loaders:**
```typescript
// While loading sessions
<div className="space-y-4">
  {[1, 2, 3].map(i => (
    <Card key={i} className="p-6">
      <Skeleton className="h-6 w-1/3 rounded-lg" />
      <Skeleton className="mt-3 h-4 w-2/3 rounded-lg" />
      <Skeleton className="mt-3 h-4 w-1/2 rounded-lg" />
    </Card>
  ))}
</div>
```

**Spinner for Actions:**
```typescript
<Button
  isLoading={isSaving}
  spinner={<Spinner size="sm" color="white" />}
>
  {isSaving ? 'Saving...' : 'Save Session'}
</Button>
```

### 9.5 Empty States

**Flexible Sessions Empty:**
```typescript
<div className="flex flex-col items-center justify-center py-16">
  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary-50">
    <span className="text-5xl">📅</span>
  </div>
  <h3 className="mb-2 text-xl font-semibold">No flexible sessions yet</h3>
  <p className="mb-6 max-w-md text-center text-default-600">
    Create date ranges and durations that parents can choose from
  </p>
  <Button color="primary" size="lg" onPress={openAddModal}>
    Add Flexible Session
  </Button>
</div>
```

---

## 10. Validation & Business Rules

### 10.1 Form Validation Rules

**Flexible Session:**

| Field | Rules | Error Messages |
|-------|-------|----------------|
| Name | Required, 1-100 chars | "Session name is required" / "Name must be 100 characters or less" |
| Start Date | Required, future date | "Start date is required" / "Start date must be in the future" |
| End Date | Required, after start date | "End date is required" / "End date must be after start date" |
| Durations | At least 1, max 10 | "At least one duration is required" / "Maximum 10 durations allowed" |
| Duration Price | Required, > 0 | "Price is required" / "Price must be greater than 0" |
| Capacity | Optional, > 0 if set | "Capacity must be greater than 0" |
| Blackout Dates | Optional, within session range | "Blackout dates must be within session date range" |

**Fixed Session:**

| Field | Rules | Error Messages |
|-------|-------|----------------|
| Name | Required, 1-100 chars | "Session name is required" / "Name must be 100 characters or less" |
| Start Date | Required, future date | "Start date is required" / "Start date must be in the future" |
| End Date | Required, after start date, min 1 day | "End date is required" / "Session must be at least 1 day long" |
| Price | Required, > 0 | "Price is required" / "Price must be greater than 0" |
| Capacity | Optional, > 0 if set | "Capacity must be greater than 0" |

### 10.2 Business Logic Rules

**Session Type:**
1. Can only be set once (when first session is created)
2. Cannot be changed if any sessions exist
3. Must be set before camp can be published

**Session Limits:**
1. Maximum 10 flexible sessions per camp
2. Maximum 50 fixed sessions per camp
3. Maximum 10 duration options per flexible session

**Date Validation:**
1. Session dates cannot overlap (for fixed sessions)
2. Blackout dates must be within session date range
3. Cannot create sessions with past dates
4. Cannot edit dates if bookings exist

**Capacity Rules:**
1. Unlimited capacity = null in database
2. Cannot reduce capacity below current bookings
3. Session becomes "Full" when bookings = capacity
4. Waitlist enabled when full (future feature)

**Pricing Rules:**
1. Prices must be positive numbers
2. Maximum 2 decimal places
3. Currency inherited from camp settings
4. Cannot change price if bookings exist (must create new session)

**Deletion Rules:**
1. Cannot delete session with active bookings
2. Must cancel all bookings first
3. Show warning with booking count
4. Soft delete option for historical data (future feature)

### 10.3 Validation Utilities

```typescript
// utils/sessionValidators.ts
import { differenceInDays, isAfter, isBefore, isFuture } from 'date-fns'

export function validateSessionDates(
  startDate: Date,
  endDate: Date
): { valid: boolean; error?: string } {
  if (!isFuture(startDate)) {
    return { valid: false, error: 'Start date must be in the future' }
  }

  if (!isAfter(endDate, startDate)) {
    return { valid: false, error: 'End date must be after start date' }
  }

  const duration = differenceInDays(endDate, startDate)
  if (duration < 1) {
    return { valid: false, error: 'Session must be at least 1 day long' }
  }

  return { valid: true }
}

export function validateBlackoutDates(
  blackoutDates: BlackoutDate[],
  sessionStart: Date,
  sessionEnd: Date
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  blackoutDates.forEach((blackout, index) => {
    const start = new Date(blackout.start)
    const end = new Date(blackout.end)

    if (isBefore(start, sessionStart) || isAfter(end, sessionEnd)) {
      errors.push(`Blackout date ${index + 1} is outside session date range`)
    }

    if (!isAfter(end, start)) {
      errors.push(`Blackout date ${index + 1} end must be after start`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export function validateDurations(
  durations: BaseDuration[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (durations.length === 0) {
    errors.push('At least one duration is required')
  }

  if (durations.length > 10) {
    errors.push('Maximum 10 durations allowed')
  }

  durations.forEach((duration, index) => {
    if (duration.price <= 0) {
      errors.push(`Duration ${index + 1} price must be greater than 0`)
    }

    if (duration.weeks < 1 || duration.weeks > 52) {
      errors.push(`Duration ${index + 1} weeks must be between 1 and 52`)
    }

    if (duration.days && (duration.days < 1 || duration.days > 365)) {
      errors.push(`Duration ${index + 1} days must be between 1 and 365`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export function canEditSession(
  session: Session,
  bookingsCount: number
): { canEdit: boolean; restrictions: string[] } {
  const restrictions: string[] = []

  if (bookingsCount > 0) {
    restrictions.push('Cannot change dates (bookings exist)')
    restrictions.push('Cannot change pricing (bookings exist)')
    restrictions.push('Cannot reduce capacity below current bookings')
  }

  return {
    canEdit: restrictions.length === 0,
    restrictions
  }
}
```

---

## 11. Edge Cases & Error Handling

### 11.1 Edge Cases

**1. Session Type Change Attempt**
- **Scenario:** User tries to change session type after creating sessions
- **Handling:**
  - Disable session type selector
  - Show info message: "Session type cannot be changed once sessions are created"
  - Provide option to delete all sessions to change type

**2. Overlapping Sessions (Fixed)**
- **Scenario:** User creates fixed session with dates overlapping existing session
- **Handling:**
  - Validate on backend
  - Show error: "Session dates overlap with existing session [Name]"
  - Highlight conflicting session in UI

**3. Capacity Reduction**
- **Scenario:** User tries to reduce capacity below current bookings
- **Handling:**
  - Validate on backend
  - Show error: "Cannot reduce capacity to X. Current bookings: Y"
  - Suggest canceling bookings first

**4. Past Date Sessions**
- **Scenario:** User tries to create session with past dates
- **Handling:**
  - Validate on frontend and backend
  - Show error: "Session dates must be in the future"
  - Auto-adjust to today's date + 1 day

**5. Blackout Dates Outside Range**
- **Scenario:** User adds blackout date outside session date range
- **Handling:**
  - Validate on change
  - Show inline error
  - Disable save until fixed

**6. Session Deletion with Bookings**
- **Scenario:** User tries to delete session with active bookings
- **Handling:**
  - Block deletion
  - Show modal: "Cannot delete session with X active bookings"
  - Provide link to bookings management
  - Option to deactivate instead of delete

**7. Network Failure During Save**
- **Scenario:** Auto-save fails due to network error
- **Handling:**
  - Show error indicator
  - Retry automatically (max 3 attempts)
  - Show manual "Retry" button
  - Preserve form data in local state

**8. Concurrent Edits**
- **Scenario:** Two users edit same session simultaneously
- **Handling:**
  - Use optimistic locking (version field)
  - Show conflict error
  - Offer to reload and merge changes

**9. Maximum Sessions Reached**
- **Scenario:** User tries to add 11th flexible session (limit: 10)
- **Handling:**
  - Disable "Add Session" button
  - Show info banner: "Maximum 10 flexible sessions reached"
  - Suggest deleting unused sessions

**10. Invalid Price Format**
- **Scenario:** User enters price with more than 2 decimal places
- **Handling:**
  - Auto-round to 2 decimals on blur
  - Show warning: "Price rounded to 2 decimal places"
  - Validate on backend

### 11.2 Error Messages

**User-Friendly Error Messages:**

```typescript
const ERROR_MESSAGES = {
  // Network Errors
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',

  // Validation Errors
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_DATE: 'Please enter a valid date',
  DATE_IN_PAST: 'Date must be in the future',
  END_BEFORE_START: 'End date must be after start date',
  INVALID_PRICE: 'Please enter a valid price (e.g., 99.99)',
  INVALID_CAPACITY: 'Capacity must be a positive number',

  // Business Logic Errors
  SESSION_TYPE_LOCKED: 'Cannot change session type once sessions are created',
  OVERLAPPING_SESSIONS: (name: string) => `Dates overlap with session "${name}"`,
  CAPACITY_TOO_LOW: (current: number) => `Cannot reduce capacity below ${current} (current bookings)`,
  MAX_SESSIONS_REACHED: (max: number) => `Maximum ${max} sessions allowed`,
  HAS_BOOKINGS: (count: number) => `Cannot delete session with ${count} active booking(s)`,

  // Generic Errors
  SAVE_FAILED: 'Failed to save changes. Please try again.',
  DELETE_FAILED: 'Failed to delete session. Please try again.',
  LOAD_FAILED: 'Failed to load sessions. Please refresh the page.',
}
```

### 11.3 Error Handling Patterns

**API Error Handling:**

```typescript
// In API service
try {
  const response = await apiClient.post(url, data)
  if (!response.success) {
    // Extract error message from response
    const errorMessage = response.data?.message || 'An error occurred'
    throw new Error(errorMessage)
  }
  return response.data
} catch (error) {
  if (error instanceof Error) {
    // Re-throw with user-friendly message
    throw new Error(ERROR_MESSAGES.SAVE_FAILED)
  }
  throw error
}
```

**Component Error Handling:**

```typescript
// In component
const [error, setError] = useState<string | null>(null)

const handleSave = async () => {
  try {
    setError(null)
    await saveSession(data)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred')
    // Show toast notification
    addToast({
      type: 'error',
      message: err instanceof Error ? err.message : 'An error occurred'
    })
  }
}

// In JSX
{error && (
  <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
    <p className="text-sm text-danger-700">{error}</p>
  </div>
)}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

**Backend Tests:**

```typescript
// sessions.service.spec.ts
describe('SessionsService', () => {
  describe('createFlexibleSession', () => {
    it('should create flexible session with valid data', async () => {
      // Test implementation
    })

    it('should throw error if end date is before start date', async () => {
      // Test implementation
    })

    it('should throw error if no durations provided', async () => {
      // Test implementation
    })

    it('should throw error if session type is fixed', async () => {
      // Test implementation
    })
  })

  describe('deleteSession', () => {
    it('should delete session with no bookings', async () => {
      // Test implementation
    })

    it('should throw error if session has bookings', async () => {
      // Test implementation
    })
  })
})
```

**Frontend Tests:**

```typescript
// SessionTypeSelector.test.tsx
describe('SessionTypeSelector', () => {
  it('should render both session type options', () => {
    // Test implementation
  })

  it('should enable continue button when type is selected', () => {
    // Test implementation
  })

  it('should call onTypeSelected when continue is clicked', async () => {
    // Test implementation
  })
})

// FlexibleSessionForm.test.tsx
describe('FlexibleSessionForm', () => {
  it('should validate required fields', () => {
    // Test implementation
  })

  it('should show error if end date is before start date', () => {
    // Test implementation
  })

  it('should allow adding multiple durations', () => {
    // Test implementation
  })
})
```

### 12.2 Integration Tests

**API Integration:**

```typescript
describe('Sessions API Integration', () => {
  it('should create and retrieve flexible session', async () => {
    // 1. Create session
    const createResponse = await request(app)
      .post('/provider/camps/test-camp-id/sessions/flexible')
      .send(validFlexibleSessionData)
      .expect(201)

    // 2. Retrieve sessions
    const getResponse = await request(app)
      .get('/provider/camps/test-camp-id/sessions/flexible')
      .expect(200)

    expect(getResponse.body.sessions).toHaveLength(1)
    expect(getResponse.body.sessions[0].name).toBe(validFlexibleSessionData.name)
  })

  it('should prevent session type change with existing sessions', async () => {
    // 1. Set session type to flexible
    await request(app)
      .patch('/provider/camps/test-camp-id/session-type')
      .send({ sessionType: 'flexible' })
      .expect(200)

    // 2. Create a session
    await request(app)
      .post('/provider/camps/test-camp-id/sessions/flexible')
      .send(validFlexibleSessionData)
      .expect(201)

    // 3. Try to change session type
    const response = await request(app)
      .patch('/provider/camps/test-camp-id/session-type')
      .send({ sessionType: 'fixed' })
      .expect(400)

    expect(response.body.message).toContain('Cannot change session type')
  })
})
```

### 12.3 E2E Tests

**User Flows:**

```typescript
// e2e/sessions.spec.ts
describe('Sessions Management E2E', () => {
  it('should complete full flexible session creation flow', async () => {
    // 1. Navigate to sessions page
    await page.goto('/camps/test-camp-id/edit/sessions')

    // 2. Select flexible session type
    await page.click('[data-testid="flexible-session-card"]')
    await page.click('[data-testid="continue-button"]')

    // 3. Open add session modal
    await page.click('[data-testid="add-session-button"]')

    // 4. Fill step 1
    await page.fill('[name="name"]', 'Summer 2026')
    await page.fill('[name="startDate"]', '2026-06-01')
    await page.fill('[name="endDate"]', '2026-08-31')
    await page.click('[data-testid="duration-1-week"]')
    await page.click('[data-testid="next-button"]')

    // 5. Fill step 2
    await page.fill('[name="durations.0.price"]', '500')
    await page.fill('[name="capacity"]', '50')
    await page.click('[data-testid="create-button"]')

    // 6. Verify session created
    await expect(page.locator('[data-testid="session-card"]')).toBeVisible()
    await expect(page.locator('text=Summer 2026')).toBeVisible()
  })
})
```

### 12.4 Test Coverage Goals

- **Backend:** 90%+ coverage
- **Frontend Components:** 80%+ coverage
- **Critical Paths:** 100% coverage
  - Session creation
  - Session deletion with bookings check
  - Session type locking
  - Date validation
  - Capacity validation

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Database, backend API, and basic types

**Tasks:**
1. ✅ Create Prisma schema updates
2. ✅ Run database migration
3. ✅ Create DTOs and validation
4. ✅ Implement SessionsService (CRUD operations)
5. ✅ Implement SessionsController
6. ✅ Write backend unit tests
7. ✅ Create TypeScript types for frontend
8. ✅ Create API service layer

**Deliverables:**
- Working backend API
- Database schema in place
- API documentation
- Unit tests passing

### Phase 2: Core UI Components (Week 2)
**Goal:** Build reusable UI components

**Tasks:**
1. ✅ Create SessionTypeSelector component
2. ✅ Create FlexibleSessionsList component
3. ✅ Create FlexibleSessionCard component
4. ✅ Create AddFlexibleSessionModal (Step 1 & 2)
5. ✅ Create FixedSessionsList component
6. ✅ Create AddFixedSessionModal
7. ✅ Create shared components (badges, indicators)
8. ✅ Implement responsive design
9. ✅ Add accessibility features

**Deliverables:**
- All UI components built
- Component storybook/documentation
- Responsive on all devices
- Accessibility compliant

### Phase 3: Integration (Week 3)
**Goal:** Integrate with wizard and editor

**Tasks:**
1. ✅ Add Step 5 to Camp Creation Wizard
2. ✅ Update wizard sidebar and footer
3. ✅ Add Sessions to Camp Editor sidebar
4. ✅ Update editor footer for auto-save
5. ✅ Implement custom hooks (useSessionsData, useSessionMutations)
6. ✅ Add validation logic
7. ✅ Implement auto-save functionality
8. ✅ Add error handling

**Deliverables:**
- Sessions integrated in wizard
- Sessions integrated in editor
- Auto-save working
- Error handling in place

### Phase 4: Advanced Features (Week 4)
**Goal:** Polish and advanced functionality

**Tasks:**
1. ✅ Implement session duplication
2. ✅ Add bulk operations
3. ✅ Implement blackout dates UI
4. ✅ Add session reordering (drag & drop)
5. ✅ Implement capacity indicators
6. ✅ Add session status management
7. ✅ Create empty states
8. ✅ Add loading skeletons

**Deliverables:**
- All advanced features working
- Polished UI/UX
- Performance optimized

### Phase 5: Testing & QA (Week 5)
**Goal:** Comprehensive testing and bug fixes

**Tasks:**
1. ✅ Write integration tests
2. ✅ Write E2E tests
3. ✅ Perform manual QA testing
4. ✅ Test all edge cases
5. ✅ Fix identified bugs
6. ✅ Performance testing
7. ✅ Accessibility audit
8. ✅ Cross-browser testing

**Deliverables:**
- All tests passing
- No critical bugs
- Performance benchmarks met
- Accessibility compliant

### Phase 6: Documentation & Deployment (Week 6)
**Goal:** Documentation and production deployment

**Tasks:**
1. ✅ Write user documentation
2. ✅ Create developer documentation
3. ✅ Update API documentation
4. ✅ Create video tutorials (optional)
5. ✅ Deploy to staging
6. ✅ Staging testing
7. ✅ Deploy to production
8. ✅ Monitor for issues

**Deliverables:**
- Complete documentation
- Production deployment
- Monitoring in place
- Support ready

---

## 14. Success Metrics

### 14.1 Technical Metrics

- **Performance:**
  - Page load time < 2s
  - API response time < 500ms
  - Auto-save latency < 1.5s

- **Reliability:**
  - 99.9% uptime
  - < 0.1% error rate
  - Zero data loss incidents

- **Code Quality:**
  - 90%+ test coverage
  - Zero critical security vulnerabilities
  - Lighthouse score > 90

### 14.2 User Experience Metrics

- **Usability:**
  - Session creation completion rate > 95%
  - Average time to create session < 3 minutes
  - User satisfaction score > 4.5/5

- **Adoption:**
  - 80%+ of camps have sessions configured within 1 week
  - < 5% support tickets related to sessions

### 14.3 Business Metrics

- **Impact:**
  - Enable booking functionality for all camps
  - Reduce manual booking management by 70%
  - Increase camp publishing rate by 30%

---

## 15. Future Enhancements

### 15.1 Short-term (3-6 months)

1. **Session Templates**
   - Save session configurations as templates
   - Reuse templates for recurring camps
   - Share templates across camps

2. **Waitlist Management**
   - Enable waitlist when session is full
   - Automatic notifications when spots open
   - Waitlist priority management

3. **Early Bird Pricing**
   - Set discounted prices with cutoff dates
   - Automatic price updates
   - Promotional pricing tiers

4. **Session-Specific Add-ons**
   - Override camp-level add-ons per session
   - Session-specific equipment or activities
   - Conditional add-ons based on duration

### 15.2 Long-term (6-12 months)

1. **Dynamic Pricing**
   - Demand-based pricing
   - Last-minute discounts
   - Group booking discounts

2. **Multi-Session Packages**
   - Bundle multiple sessions
   - Package discounts
   - Sibling discounts

3. **Advanced Capacity Management**
   - Age-group specific capacity
   - Gender-based capacity splits
   - Skill-level capacity management

4. **Session Analytics**
   - Booking trends
   - Revenue forecasting
   - Capacity utilization reports

5. **Integration with Calendar**
   - Export sessions to calendar
   - Sync with Google Calendar
   - iCal feed for parents

---

## 16. Appendix

### 16.1 Glossary

- **Session Type:** The booking model for a camp (flexible or fixed)
- **Flexible Session:** A session where parents choose start date and duration
- **Fixed Session:** A session with predetermined start and end dates
- **Duration:** The length of time a camper attends (in weeks or days)
- **Capacity:** Maximum number of campers per session
- **Blackout Dates:** Dates when camp is closed within a session range
- **Auto-Save:** Automatic saving of changes without manual save button

### 16.2 References

- **Design Files:** `/sessions/` directory
- **Existing Patterns:** Camp Editor auto-save pages
- **HeroUI Documentation:** https://heroui.com
- **Prisma Documentation:** https://www.prisma.io/docs

### 16.3 Questions & Clarifications

**Resolved:**
- ✅ Session type is mutually exclusive per camp
- ✅ Auto-save pattern matches existing pages
- ✅ Single reusable component for wizard and editor
- ✅ Maximum session limits defined

**Pending:**
- ❓ Currency handling for multi-currency camps
- ❓ Timezone handling for international camps
- ❓ Refund policy integration
- ❓ Cancellation policy per session

---

## 17. Conclusion

This implementation plan provides a comprehensive blueprint for building the Sessions Management feature. It covers all aspects from database design to UI components, ensuring consistency with existing patterns while introducing new functionality.

**Key Takeaways:**
1. Two distinct session types with clear use cases
2. Robust validation and error handling
3. Seamless integration with existing wizard and editor
4. Auto-save functionality for better UX
5. Scalable architecture for future enhancements

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule regular check-ins for progress updates

---

**Document Version:** 1.0
**Last Updated:** 2026-01-16
**Author:** AI Assistant
**Reviewers:** [To be added]
**Status:** Ready for Review

