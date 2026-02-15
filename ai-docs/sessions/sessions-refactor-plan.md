# Sessions Feature Refactor - Implementation Plan

## 📋 Overview

This document outlines the step-by-step implementation plan for refactoring the Sessions creation feature to align with the new design specification. The refactor removes flexible session functionality and implements a new fixed session schema with enhanced features.

**Design Reference:** `WC-Booking/Provider/Sessions/✅1-session-creation-dashboard_13.html`  
**Implementation Spec:** `WC-Booking/Provider/Sessions/1-session-creation-IMPLEMENTATION-SPECIFICATION.md`

---

## 🎯 Goals

1. Remove all flexible session functionality
2. Remove session type selection logic (all sessions are now fixed)
3. Update Session schema to match new design specification
4. Implement new session fields: half-day, pricing types, availability types, age group support
5. Update backend validation and business logic
6. Update frontend components and forms
7. Update shared types across apps

---

## 📦 Affected Applications

- **wc-nest-api** (Backend API)
- **wc-provider** (Provider Frontend)
- **wc-booking** (Customer Booking Frontend)

---

## 🗂️ Implementation Phases

### **Phase 1: Database Schema Changes**
### **Phase 2: Backend API Updates**
### **Phase 3: Frontend Types Updates**
### **Phase 4: Frontend Components Updates**
### **Phase 5: Testing & Validation**

---

## Phase 1: Database Schema Changes

### 1.1 Update Prisma Schema

**File:** `world-schools/apps/wc-nest-api/prisma/schema.prisma`

#### Changes to `Camp` model:

```prisma
model Camp {
  // ... existing fields ...
  
  // REMOVE this field:
  // sessionType SessionType? @map("session_type")
  
  // ... rest of fields ...
}
```

#### Changes to `Session` model:

```prisma
model Session {
  id     String @id @default(uuid())
  campId String @map("camp_id")
  
  // REMOVE type field - all sessions are now fixed
  // type   SessionType
  
  // Basic Fields
  name        String  @db.VarChar(60)  // Changed from 100 to 60
  startDate   DateTime @map("start_date")  // Actual session start
  endDate     DateTime @map("end_date")    // Actual session end
  
  // Session Type (only for day camps)
  sessionType SessionDayType? @map("session_type")  // 'full_day' | 'half_day'
  arrivalTime String?         @map("arrival_time")   // HH:MM format, only for half_day
  departureTime String?       @map("departure_time") // HH:MM format, only for half_day
  
  // Pricing
  pricingType     PricingType @default(single) @map("pricing_type")  // 'single' | 'age_group'
  price           Decimal?    @db.Decimal(10, 2)  // For single pricing
  ageGroupPrices  Json?       @map("age_group_prices")  // [{age_group_id: string, price: number}]
  
  // Availability
  availabilityType AvailabilityType @default(single) @map("availability_type")  // 'single' | 'age_group'
  totalSpots       Int?             @map("total_spots")  // For single availability
  ageGroupSpots    Json?            @map("age_group_spots")  // [{age_group_id: string, spots: number}]
  
  // Status
  status SessionStatus @default(draft)  // 'draft' | 'published'
  
  // Metadata
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  // Relations
  camp     Camp      @relation(fields: [campId], references: [id], onDelete: Cascade)
  bookings Booking[]
  
  // REMOVE all flexible session fields:
  // - isActive, capacity, description
  // - startDate (booking window), endDate (booking window)
  // - blackoutDates, basePricePerDay, requireConsecutiveDays
  // - minDaysLimit, maxDaysLimit, availableDaysOfWeek
  // - specificStartDays, discountTiers, dayOfWeekPricing
  // - ageRange, unlimitedCapacity, boysCapacity, girlsCapacity
  // - separateGenderCapacity
  // - sessionStartDate, sessionEndDate (replaced by startDate, endDate)
  
  @@index([campId])
  @@index([status])
  @@index([sortOrder])
  @@map("sessions")
}
```

#### Add new enums:

```prisma
enum SessionDayType {
  full_day
  half_day
}

enum PricingType {
  single
  age_group
}

enum AvailabilityType {
  single
  age_group
}

enum SessionStatus {
  draft
  published
}
```

#### Remove old enums:

```prisma
// REMOVE:
// enum SessionType {
//   flexible
//   fixed
// }
```

### 1.2 Create Migration

**Commands:**
```bash
cd world-schools/apps/wc-nest-api
npx prisma migrate dev --name refactor_sessions_remove_flexible
```

**⚠️ Important:** This is a breaking migration. Existing session data will need to be migrated or cleared.

---

## Phase 2: Backend API Updates

### 2.1 Remove Flexible Session DTOs

**Files to DELETE:**
- `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/create-flexible-session.dto.ts`
- `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/update-flexible-session.dto.ts`
- `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/update-session-type.dto.ts`

### 2.2 Update Fixed Session DTOs

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/create-fixed-session.dto.ts`

**Replace entire file with:**

```typescript
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ValidateIf,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'

// Age group pricing DTO
export class AgeGroupPriceDto {
  @IsString()
  @IsNotEmpty()
  age_group_id: string

  @IsNumber()
  @Min(0)
  price: number
}

// Age group spots DTO
export class AgeGroupSpotsDto {
  @IsString()
  @IsNotEmpty()
  age_group_id: string

  @IsNumber()
  @Min(1)
  spots: number
}

export class CreateFixedSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  session_name: string

  @IsDateString()
  start_date: string

  @IsDateString()
  end_date: string

  // Session type (only for day camps)
  @IsOptional()
  @IsEnum(['full_day', 'half_day'])
  session_type?: 'full_day' | 'half_day'

  @ValidateIf(o => o.session_type === 'half_day')
  @IsString()
  @IsNotEmpty()
  arrival_time?: string // HH:MM format

  @ValidateIf(o => o.session_type === 'half_day')
  @IsString()
  @IsNotEmpty()
  departure_time?: string // HH:MM format

  // Pricing
  @IsEnum(['single', 'age_group'])
  pricing_type: 'single' | 'age_group'

  @ValidateIf(o => o.pricing_type === 'single')
  @IsNumber()
  @Min(0)
  price?: number

  @ValidateIf(o => o.pricing_type === 'age_group')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgeGroupPriceDto)
  age_group_prices?: AgeGroupPriceDto[]

  // Availability
  @IsEnum(['single', 'age_group'])
  availability_type: 'single' | 'age_group'

  @ValidateIf(o => o.availability_type === 'single')
  @IsNumber()
  @Min(1)
  total_spots?: number

  @ValidateIf(o => o.availability_type === 'age_group')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgeGroupSpotsDto)
  age_group_spots?: AgeGroupSpotsDto[]

  // Status
  @IsEnum(['draft', 'published'])
  status: 'draft' | 'published'
}
```

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/update-fixed-session.dto.ts`

**Replace entire file with:**

```typescript
import { PartialType } from '@nestjs/mapped-types'
import { CreateFixedSessionDto } from './create-fixed-session.dto'

export class UpdateFixedSessionDto extends PartialType(CreateFixedSessionDto) {}
```

### 2.3 Update Sessions Service

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/sessions.service.ts`

**Changes:**

1. **Remove imports:**
```typescript
// REMOVE:
import { CreateFlexibleSessionDto } from './dto/create-flexible-session.dto'
import { UpdateFlexibleSessionDto } from './dto/update-flexible-session.dto'
import { UpdateSessionTypeDto } from './dto/update-session-type.dto'
```

2. **Remove methods:**
- `getSessionType()`
- `setSessionType()`
- `createFlexibleSession()`
- `updateFlexibleSession()`
- `getFlexibleSessions()`

3. **Update `getAllSessions()` method:**
```typescript
async getAllSessions(campId: string, providerId: string) {
  await this.validateCampOwnership(campId, providerId)

  const sessions = await this.prisma.session.findMany({
    where: { campId },
    orderBy: { sortOrder: 'asc' },
  })

  return {
    sessions: sessions.map(s => this.transformSessionForResponse(s)),
    total: sessions.length,
  }
}
```

4. **Update `createFixedSession()` method:**
```typescript
async createFixedSession(campId: string, providerId: string, dto: CreateFixedSessionDto) {
  const camp = await this.validateCampOwnership(campId, providerId)

  // Validate dates
  const startDate = new Date(dto.start_date)
  const endDate = new Date(dto.end_date)

  if (endDate <= startDate) {
    throw new BadRequestException('End date must be after start date')
  }

  // Validate half-day session (only for day camps)
  if (dto.session_type === 'half_day') {
    if (camp.type !== 'day') {
      throw new BadRequestException('Half-day sessions are only available for day camps')
    }

    if (!dto.arrival_time || !dto.departure_time) {
      throw new BadRequestException('Arrival and departure times are required for half-day sessions')
    }

    // Validate time format and logic
    const arrivalTime = dto.arrival_time.split(':')
    const departureTime = dto.departure_time.split(':')
    const arrivalMinutes = parseInt(arrivalTime[0]) * 60 + parseInt(arrivalTime[1])
    const departureMinutes = parseInt(departureTime[0]) * 60 + parseInt(departureTime[1])

    if (departureMinutes <= arrivalMinutes) {
      throw new BadRequestException('Departure time must be after arrival time')
    }
  }

  // Validate age group pricing
  if (dto.pricing_type === 'age_group') {
    const ageGroups = camp.ageGroups as any[]

    if (!ageGroups || ageGroups.length < 2) {
      throw new BadRequestException('Age group pricing requires at least 2 age groups configured in camp settings')
    }

    if (!dto.age_group_prices || dto.age_group_prices.length === 0) {
      throw new BadRequestException('Age group prices are required when using age group pricing')
    }

    // Validate all age groups have prices
    const providedAgeGroupIds = dto.age_group_prices.map(agp => agp.age_group_id)
    const campAgeGroupIds = ageGroups.map(ag => ag.id)

    const missingAgeGroups = campAgeGroupIds.filter(id => !providedAgeGroupIds.includes(id))
    if (missingAgeGroups.length > 0) {
      throw new BadRequestException('All age groups must have prices when using age group pricing')
    }
  } else {
    // Single pricing requires price
    if (dto.price === undefined || dto.price === null) {
      throw new BadRequestException('Price is required when using single pricing')
    }
  }

  // Validate age group availability
  if (dto.availability_type === 'age_group') {
    const ageGroups = camp.ageGroups as any[]

    if (!ageGroups || ageGroups.length < 2) {
      throw new BadRequestException('Age group availability requires at least 2 age groups configured in camp settings')
    }

    if (!dto.age_group_spots || dto.age_group_spots.length === 0) {
      throw new BadRequestException('Age group spots are required when using age group availability')
    }

    // Validate all age groups have spots
    const providedAgeGroupIds = dto.age_group_spots.map(ags => ags.age_group_id)
    const campAgeGroupIds = ageGroups.map(ag => ag.id)

    const missingAgeGroups = campAgeGroupIds.filter(id => !providedAgeGroupIds.includes(id))
    if (missingAgeGroups.length > 0) {
      throw new BadRequestException('All age groups must have spots when using age group availability')
    }
  } else {
    // Single availability requires total_spots
    if (!dto.total_spots) {
      throw new BadRequestException('Total spots is required when using single availability')
    }
  }

  // Check for overlapping sessions
  const overlappingSessions = await this.prisma.session.findFirst({
    where: {
      campId,
      OR: [
        {
          AND: [
            { startDate: { lte: startDate } },
            { endDate: { gte: startDate } },
          ],
        },
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: endDate } },
          ],
        },
        {
          AND: [
            { startDate: { gte: startDate } },
            { endDate: { lte: endDate } },
          ],
        },
      ],
    },
  })

  if (overlappingSessions) {
    throw new BadRequestException(
      `Session dates overlap with existing session "${overlappingSessions.name}"`
    )
  }

  // Check session limit (max 50 sessions)
  const existingCount = await this.prisma.session.count({
    where: { campId },
  })

  if (existingCount >= 50) {
    throw new BadRequestException('Maximum of 50 sessions allowed per camp')
  }

  // Get next sort order
  const maxSortOrder = await this.prisma.session.findFirst({
    where: { campId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const sortOrder = maxSortOrder ? maxSortOrder.sortOrder + 1 : 0

  // Create session
  const session = await this.prisma.session.create({
    data: {
      campId,
      name: dto.session_name,
      startDate,
      endDate,
      sessionType: dto.session_type || 'full_day',
      arrivalTime: dto.arrival_time,
      departureTime: dto.departure_time,
      pricingType: dto.pricing_type,
      price: dto.price,
      ageGroupPrices: dto.age_group_prices as any,
      availabilityType: dto.availability_type,
      totalSpots: dto.total_spots,
      ageGroupSpots: dto.age_group_spots as any,
      status: dto.status,
      sortOrder,
    },
  })

  return {
    session: this.transformSessionForResponse(session),
    message: 'Session created successfully',
  }
}
```

5. **Update `updateFixedSession()` method:**

Similar validation logic as `createFixedSession()`, but:
- Check if session has bookings before allowing certain changes
- Exclude current session when checking for overlaps
- Allow partial updates

6. **Update `transformSessionForResponse()` method:**

```typescript
private transformSessionForResponse(session: any) {
  return {
    id: session.id,
    campId: session.campId,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    sessionType: session.sessionType,
    arrivalTime: session.arrivalTime,
    departureTime: session.departureTime,
    pricingType: session.pricingType,
    price: session.price ? parseFloat(session.price) : null,
    ageGroupPrices: session.ageGroupPrices,
    availabilityType: session.availabilityType,
    totalSpots: session.totalSpots,
    ageGroupSpots: session.ageGroupSpots,
    status: session.status,
    sortOrder: session.sortOrder,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}
```

### 2.4 Update Sessions Controller

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/sessions.controller.ts`

**Changes:**

1. **Remove imports:**
```typescript
// REMOVE:
import { CreateFlexibleSessionDto } from './dto/create-flexible-session.dto'
import { UpdateFlexibleSessionDto } from './dto/update-flexible-session.dto'
import { UpdateSessionTypeDto } from './dto/update-session-type.dto'
```

2. **Remove endpoints:**
- `GET /camps/:campId/sessions/type`
- `PUT /camps/:campId/sessions/type`
- `GET /camps/:campId/sessions/flexible`
- `POST /camps/:campId/sessions/flexible`
- `PUT /camps/:campId/sessions/flexible/:sessionId`

3. **Update remaining endpoints:**

```typescript
@Get(':campId/sessions')
@ApiOperation({ summary: 'Get all sessions for a camp' })
async getAllSessions(@Param('campId') campId: string, @GetUser('id') providerId: string) {
  return this.sessionsService.getAllSessions(campId, providerId)
}

@Post(':campId/sessions')
@ApiOperation({ summary: 'Create a new session' })
async createSession(
  @Param('campId') campId: string,
  @GetUser('id') providerId: string,
  @Body() dto: CreateFixedSessionDto
) {
  return this.sessionsService.createFixedSession(campId, providerId, dto)
}

@Put(':campId/sessions/:sessionId')
@ApiOperation({ summary: 'Update a session' })
async updateSession(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @GetUser('id') providerId: string,
  @Body() dto: UpdateFixedSessionDto
) {
  return this.sessionsService.updateFixedSession(campId, sessionId, providerId, dto)
}

@Delete(':campId/sessions/:sessionId')
@ApiOperation({ summary: 'Delete a session' })
async deleteSession(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @GetUser('id') providerId: string
) {
  return this.sessionsService.deleteSession(campId, sessionId, providerId)
}

@Post(':campId/sessions/:sessionId/duplicate')
@ApiOperation({ summary: 'Duplicate a session' })
async duplicateSession(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @GetUser('id') providerId: string
) {
  return this.sessionsService.duplicateSession(campId, sessionId, providerId)
}

@Patch(':campId/sessions/:sessionId/status')
@ApiOperation({ summary: 'Toggle session status (draft/published)' })
async toggleSessionStatus(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @GetUser('id') providerId: string
) {
  return this.sessionsService.toggleSessionStatus(campId, sessionId, providerId)
}
```

---

## Phase 3: Frontend Types Updates

### 3.1 Update wc-provider Types

**File:** `world-schools/apps/wc-provider/src/types/sessions.ts`

**Replace entire file with:**

```typescript
// Session Types for wc-provider app

// Age group pricing
export interface AgeGroupPrice {
  age_group_id: string
  price: number
}

// Age group spots
export interface AgeGroupSpots {
  age_group_id: string
  spots: number
}

// Session interface
export interface Session {
  id: string
  campId: string
  name: string
  startDate: string // ISO date string
  endDate: string // ISO date string
  sessionType?: 'full_day' | 'half_day'
  arrivalTime?: string // HH:MM format
  departureTime?: string // HH:MM format
  pricingType: 'single' | 'age_group'
  price?: number
  ageGroupPrices?: AgeGroupPrice[]
  availabilityType: 'single' | 'age_group'
  totalSpots?: number
  ageGroupSpots?: AgeGroupSpots[]
  status: 'draft' | 'published'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// DTOs for creating/updating sessions
export interface CreateSessionDto {
  session_name: string
  start_date: string
  end_date: string
  session_type?: 'full_day' | 'half_day'
  arrival_time?: string
  departure_time?: string
  pricing_type: 'single' | 'age_group'
  price?: number
  age_group_prices?: AgeGroupPrice[]
  availability_type: 'single' | 'age_group'
  total_spots?: number
  age_group_spots?: AgeGroupSpots[]
  status: 'draft' | 'published'
}

export interface UpdateSessionDto extends Partial<CreateSessionDto> {}

// API Response types
export interface SessionsResponse {
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

// Form state types for UI
export interface SessionFormData {
  session_name: string
  start_date: string
  end_date: string
  session_type: 'full_day' | 'half_day'
  arrival_time: string
  departure_time: string
  pricing_type: 'single' | 'age_group'
  price: number | null
  age_group_prices: AgeGroupPrice[]
  availability_type: 'single' | 'age_group'
  total_spots: number | null
  age_group_spots: AgeGroupSpots[]
  status: 'draft' | 'published'
}

// REMOVE all flexible session types:
// - SessionType, FlexibleSession, CreateFlexibleSessionDto, etc.
```

### 3.2 Update wc-provider Services

**File:** `world-schools/apps/wc-provider/src/services/sessions.service.ts`

**Replace entire file with:**

```typescript
import apiClient from '@/utils/api-client'
import type {
  CreateSessionDto,
  UpdateSessionDto,
  DeleteSessionResponse,
  SessionsResponse,
  SessionResponse,
} from '@/types/sessions'

const BASE_PATH = '/provider/camps'

/**
 * Get all sessions for a camp
 */
export async function getAllSessions(campId: string): Promise<SessionsResponse> {
  const response = await apiClient.get<SessionsResponse>(`${BASE_PATH}/${campId}/sessions`)
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionsResponse
}

/**
 * Create a session
 */
export async function createSession(
  campId: string,
  data: CreateSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Update a session
 */
export async function updateSession(
  campId: string,
  sessionId: string,
  data: UpdateSessionDto
): Promise<SessionResponse> {
  const response = await apiClient.put<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}`,
    data
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Delete a session
 */
export async function deleteSession(
  campId: string,
  sessionId: string
): Promise<DeleteSessionResponse> {
  const response = await apiClient.del<DeleteSessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}`
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as DeleteSessionResponse
}

/**
 * Toggle session status (draft/published)
 */
export async function toggleSessionStatus(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.patch<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/status`,
    {}
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

/**
 * Duplicate a session
 */
export async function duplicateSession(
  campId: string,
  sessionId: string
): Promise<SessionResponse> {
  const response = await apiClient.post<SessionResponse>(
    `${BASE_PATH}/${campId}/sessions/${sessionId}/duplicate`,
    {}
  )
  if (!response.success) throw new Error((response.data as any).message)
  return response.data as SessionResponse
}

// REMOVE all flexible session methods:
// - getSessionType, setSessionType
// - createFlexibleSession, updateFlexibleSession
// - getFlexibleSessions
```

### 3.3 Update wc-booking Types

**File:** `world-schools/apps/wc-booking/src/types/sessions.ts`

**Replace entire file with:**

```typescript
// Session Types for wc-booking app

// Age group pricing
export interface AgeGroupPrice {
  age_group_id: string
  price: number
}

// Age group spots
export interface AgeGroupSpots {
  age_group_id: string
  spots: number
}

// Session interface
export interface Session {
  id: string
  campId: string
  name: string
  startDate: string // ISO date string
  endDate: string // ISO date string
  sessionType?: 'full_day' | 'half_day'
  arrivalTime?: string // HH:MM format
  departureTime?: string // HH:MM format
  pricingType: 'single' | 'age_group'
  price?: number
  ageGroupPrices?: AgeGroupPrice[]
  availabilityType: 'single' | 'age_group'
  totalSpots?: number
  ageGroupSpots?: AgeGroupSpots[]
  status: 'draft' | 'published'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// REMOVE all flexible session types:
// - SessionType, FlexibleSession, FixedSession
// - BlackoutDate, DiscountTier, DayOfWeekPricing, AgeRange
```

---

## Phase 4: Frontend Components Updates

### 4.1 Remove Session Type Selection Components

**Files to DELETE:**
- `world-schools/apps/wc-provider/src/components/sessions/SessionTypeSelector.tsx`
- `world-schools/apps/wc-provider/src/components/sessions/flexible/` (entire directory)

**Files to UPDATE:**

**File:** `world-schools/apps/wc-provider/src/components/sessions/index.ts`

```typescript
// Main page component
export { SessionsPage } from './SessionsPage'

// Shared components
export { SessionStatusBadge } from './shared/SessionStatusBadge'
export { SessionCapacityIndicator } from './shared/SessionCapacityIndicator'
export { SessionPricingDisplay } from './shared/SessionPricingDisplay'

// Session components (formerly "fixed" sessions)
export { SessionsManager } from './SessionsManager'  // Renamed from FixedSessionsManager
export { SessionsList } from './SessionsList'        // Renamed from FixedSessionsList
export { SessionCard } from './SessionCard'          // Renamed from FixedSessionCard
export { SessionForm } from './SessionForm'          // Renamed from FixedSessionForm
export { SessionsEmptyState } from './SessionsEmptyState'  // Renamed from FixedSessionsEmptyState

// Types
export type { SessionFormData } from './SessionForm'

// REMOVE all flexible session exports
```

### 4.2 Update SessionsPage Component

**File:** `world-schools/apps/wc-provider/src/components/sessions/SessionsPage.tsx`

**Replace entire file with:**

```typescript
'use client'

import { Spinner } from '@heroui/react'
import { useSessionsData } from '@/hooks/useSessionsData'
import { SessionsManager } from './SessionsManager'

interface SessionsPageProps {
  campId: string
}

/**
 * Sessions Page Component
 * Main entry point for session management
 */
export function SessionsPage({ campId }: SessionsPageProps) {
  const { isLoading } = useSessionsData(campId)

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  // Show sessions manager
  return <SessionsManager campId={campId} />
}
```

### 4.3 Rename and Update Fixed Session Components

**Rename files:**
- `FixedSessionsManager.tsx` → `SessionsManager.tsx`
- `FixedSessionsList.tsx` → `SessionsList.tsx`
- `FixedSessionCard.tsx` → `SessionCard.tsx`
- `FixedSessionForm.tsx` → `SessionForm.tsx`
- `FixedSessionsEmptyState.tsx` → `SessionsEmptyState.tsx`

**File:** `world-schools/apps/wc-provider/src/components/sessions/SessionForm.tsx`

This is the main form component that needs to be completely rewritten to match the new design spec.

**Key features to implement:**
1. Session name and dates (RangeCalendar)
2. Half-day toggle (conditional on camp type)
3. Arrival/departure time inputs (conditional on half-day toggle)
4. Pricing section:
   - Single price input OR
   - Age group pricing toggle + inputs for each age group
5. Availability section:
   - Single spots input OR
   - Age group availability toggle + inputs for each age group
6. Status selector (draft/published)
7. Validation per implementation spec

**Form structure:**

```typescript
export interface SessionFormData {
  session_name: string
  start_date: string
  end_date: string
  session_type: 'full_day' | 'half_day'
  arrival_time: string
  departure_time: string
  pricing_type: 'single' | 'age_group'
  price: number | null
  age_group_prices: AgeGroupPrice[]
  availability_type: 'single' | 'age_group'
  total_spots: number | null
  age_group_spots: AgeGroupSpots[]
  status: 'draft' | 'published'
}
```

**Conditional rendering logic:**

```typescript
// 1. Half-day toggle visibility
const showHalfDayToggle = camp.type === 'day'

// 2. Age group pricing toggle visibility
const showAgePricingToggle = camp.ageGroups && camp.ageGroups.length >= 2

// 3. Age group availability toggle visibility
const showAgeAvailabilityToggle = camp.ageGroups && camp.ageGroups.length >= 2

// 4. Arrival/departure time inputs visibility
const showTimePickers = formData.session_type === 'half_day'

// 5. Age group pricing inputs visibility
const showAgeGroupPricing = formData.pricing_type === 'age_group'

// 6. Age group availability inputs visibility
const showAgeGroupAvailability = formData.availability_type === 'age_group'
```

### 4.4 Update Hooks

**File:** `world-schools/apps/wc-provider/src/hooks/useSessionsData.tsx`

**Update to remove session type logic:**

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session, SessionsResponse } from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface UseSessionsDataReturn {
  sessions: Session[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useSessionsData(campId: string): UseSessionsDataReturn {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await sessionsService.getAllSessions(campId)
      setSessions(response.sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }, [campId])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return {
    sessions,
    isLoading,
    error,
    reload: loadSessions,
  }
}

// REMOVE: sessionType, canChangeType, flexibleSessions, fixedSessions, etc.
```

**File:** `world-schools/apps/wc-provider/src/hooks/useSessionMutations.tsx`

**Update to remove flexible session mutations:**

```typescript
'use client'

import { useState } from 'react'
import type { Session, CreateSessionDto, UpdateSessionDto } from '@/types/sessions'
import * as sessionsService from '@/services/sessions.service'

interface MutationCallbacks {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseSessionMutationsReturn {
  // Session CRUD
  createSession: (data: CreateSessionDto, callbacks?: MutationCallbacks) => Promise<Session | null>
  updateSession: (
    sessionId: string,
    data: UpdateSessionDto,
    callbacks?: MutationCallbacks
  ) => Promise<Session | null>
  deleteSession: (sessionId: string, callbacks?: MutationCallbacks) => Promise<void>
  duplicateSession: (sessionId: string, callbacks?: MutationCallbacks) => Promise<Session | null>
  toggleSessionStatus: (sessionId: string, callbacks?: MutationCallbacks) => Promise<Session | null>

  // Loading states
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  isDuplicating: boolean
  isToggling: boolean

  // Error state
  error: string | null
  clearError: () => void
}

export function useSessionMutations(campId: string): UseSessionMutationsReturn {
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create session
  const createSession = async (
    data: CreateSessionDto,
    callbacks?: MutationCallbacks
  ): Promise<Session | null> => {
    try {
      setIsCreating(true)
      setError(null)
      const response = await sessionsService.createSession(campId, data)
      callbacks?.onSuccess?.()
      return response.session
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create session')
      setError(error.message)
      callbacks?.onError?.(error)
      return null
    } finally {
      setIsCreating(false)
    }
  }

  // Update session
  const updateSession = async (
    sessionId: string,
    data: UpdateSessionDto,
    callbacks?: MutationCallbacks
  ): Promise<Session | null> => {
    try {
      setIsUpdating(true)
      setError(null)
      const response = await sessionsService.updateSession(campId, sessionId, data)
      callbacks?.onSuccess?.()
      return response.session
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update session')
      setError(error.message)
      callbacks?.onError?.(error)
      return null
    } finally {
      setIsUpdating(false)
    }
  }

  // Delete session
  const deleteSession = async (
    sessionId: string,
    callbacks?: MutationCallbacks
  ): Promise<void> => {
    try {
      setIsDeleting(true)
      setError(null)
      await sessionsService.deleteSession(campId, sessionId)
      callbacks?.onSuccess?.()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete session')
      setError(error.message)
      callbacks?.onError?.(error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Duplicate session
  const duplicateSession = async (
    sessionId: string,
    callbacks?: MutationCallbacks
  ): Promise<Session | null> => {
    try {
      setIsDuplicating(true)
      setError(null)
      const response = await sessionsService.duplicateSession(campId, sessionId)
      callbacks?.onSuccess?.()
      return response.session
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to duplicate session')
      setError(error.message)
      callbacks?.onError?.(error)
      return null
    } finally {
      setIsDuplicating(false)
    }
  }

  // Toggle session status
  const toggleSessionStatus = async (
    sessionId: string,
    callbacks?: MutationCallbacks
  ): Promise<Session | null> => {
    try {
      setIsToggling(true)
      setError(null)
      const response = await sessionsService.toggleSessionStatus(campId, sessionId)
      callbacks?.onSuccess?.()
      return response.session
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to toggle session status')
      setError(error.message)
      callbacks?.onError?.(error)
      return null
    } finally {
      setIsToggling(false)
    }
  }

  const clearError = () => setError(null)

  return {
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    toggleSessionStatus,
    isCreating,
    isUpdating,
    isDeleting,
    isDuplicating,
    isToggling,
    error,
    clearError,
  }
}

// REMOVE: setSessionType, createFlexibleSession, updateFlexibleSession, etc.
```

### 4.5 Update wc-booking Components

**File:** `world-schools/apps/wc-booking/src/components/camp/SessionsSection.tsx`

**Update to remove flexible session handling:**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@heroui/react'
import { SectionHeader } from './SectionHeader'
import type { Session } from '@/types/sessions'
import { formatCurrency } from '@/utils/currency'

interface SessionsSectionProps {
  sessions: Session[]
  campName: string
  currency?: string
}

export function SessionsSection({
  sessions,
  campName,
  currency = 'USD',
}: SessionsSectionProps) {
  const [showAll, setShowAll] = useState(false)

  if (!sessions || sessions.length === 0) {
    return null
  }

  // Show first 5 sessions by default
  const displayedSessions = showAll ? sessions : sessions.slice(0, 5)
  const hasMore = sessions.length > 5

  return (
    <div className="mb-12">
      <SectionHeader title="Dates & Pricing" icon="📅" className="mb-6" />

      <div className="space-y-4 mt-6">
        {displayedSessions.map(session => (
          <SessionCard key={session.id} session={session} currency={currency} />
        ))}
      </div>

      {hasMore && !showAll && (
        <div className="mt-6 text-center">
          <Button
            onPress={() => setShowAll(true)}
            variant="bordered"
            className="border-gray-900 text-gray-900 font-semibold"
          >
            Check All {sessions.length} Sessions
          </Button>
        </div>
      )}
    </div>
  )
}

// Session Card Component
function SessionCard({ session, currency = 'USD' }: { session: Session; currency?: string }) {
  const startDate = new Date(session.startDate)
  const endDate = new Date(session.endDate)

  // Calculate duration
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const weeks = Math.floor(durationDays / 7)
  const days = durationDays % 7

  // Format dates
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Calculate spots left (if single availability)
  const spotsLeft = session.availabilityType === 'single' ? session.totalSpots : null

  // Determine badge
  const getBadge = () => {
    if (session.sessionType === 'half_day') {
      return { text: 'HALF DAY', icon: '☀️', color: 'bg-blue-50 text-blue-700' }
    }
    if (spotsLeft !== null && spotsLeft !== undefined && spotsLeft <= 5) {
      return { text: 'LAST SPOTS', icon: '🔥', color: 'bg-red-50 text-red-700' }
    }
    return null
  }

  const badge = getBadge()

  // Get price to display
  const displayPrice = session.pricingType === 'single' ? session.price : null

  return (
    <div className="border border-gray-300 rounded-xl p-6 hover:shadow-md transition-shadow">
      {badge && (
        <div
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-3 ${badge.color}`}
        >
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.name}</h3>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
            <p>
              {weeks > 0 && `${weeks} week${weeks > 1 ? 's' : ''}`}
              {weeks > 0 && days > 0 && ' • '}
              {days > 0 && `${days} day${days > 1 ? 's' : ''}`}
              {weeks === 0 && days === 0 && '1 day'}
            </p>
            {session.sessionType === 'half_day' && session.arrivalTime && session.departureTime && (
              <p className="text-gray-700">
                {session.arrivalTime} - {session.departureTime}
              </p>
            )}
            {spotsLeft !== null && spotsLeft !== undefined && (
              <p className="text-gray-700 font-medium mt-2">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Fully booked'}
              </p>
            )}
          </div>
        </div>

        {displayPrice !== null && displayPrice !== undefined && (
          <div className="text-right ml-6">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(displayPrice, currency)}
            </div>
            <div className="text-sm text-gray-500 mt-1">per child</div>
          </div>
        )}
        {session.pricingType === 'age_group' && (
          <div className="text-right ml-6">
            <div className="text-sm text-gray-600">Age-based pricing</div>
          </div>
        )}
      </div>
    </div>
  )
}

// REMOVE: FlexibleSessionCard component
```

---

## Phase 5: Testing & Validation

### 5.1 Backend Testing

**Test cases:**

1. **Session Creation:**
   - ✅ Create session with single pricing and single availability
   - ✅ Create session with age group pricing and age group availability
   - ✅ Create half-day session for day camp
   - ❌ Attempt to create half-day session for overnight camp (should fail)
   - ❌ Attempt to create age group pricing with only 1 age group (should fail)
   - ❌ Attempt to create overlapping sessions (should fail)
   - ❌ Attempt to create session without required fields (should fail)

2. **Session Updates:**
   - ✅ Update session name and dates
   - ✅ Update pricing and availability
   - ✅ Toggle session status (draft ↔ published)
   - ❌ Attempt to change dates with existing bookings (should fail or warn)

3. **Session Deletion:**
   - ✅ Delete session without bookings
   - ❌ Attempt to delete session with bookings (should fail)

4. **Session Duplication:**
   - ✅ Duplicate session successfully
   - ✅ Verify duplicated session has correct data

### 5.2 Frontend Testing

**Test cases:**

1. **Conditional Rendering:**
   - ✅ Half-day toggle visible for day camps only
   - ✅ Age group toggles visible when camp has 2+ age groups
   - ✅ Time pickers visible when half-day is selected
   - ✅ Age group inputs visible when age group mode is selected

2. **Form Validation:**
   - ❌ Submit without session name (should show error)
   - ❌ Submit with end date before start date (should show error)
   - ❌ Submit half-day without times (should show error)
   - ❌ Submit with departure time before arrival time (should show error)
   - ❌ Submit age group pricing without all prices (should show error)

3. **User Flows:**
   - ✅ Create new session (draft)
   - ✅ Create new session (published)
   - ✅ Edit existing session
   - ✅ Duplicate session
   - ✅ Delete session
   - ✅ Toggle session status

### 5.3 Integration Testing

**Test scenarios:**

1. **Day Camp with Single Age Group:**
   - Half-day toggle: ✅ Visible
   - Age pricing toggle: ❌ Hidden
   - Age availability toggle: ❌ Hidden

2. **Day Camp with Multiple Age Groups:**
   - Half-day toggle: ✅ Visible
   - Age pricing toggle: ✅ Visible
   - Age availability toggle: ✅ Visible

3. **Overnight Camp with Single Age Group:**
   - Half-day toggle: ❌ Hidden
   - Age pricing toggle: ❌ Hidden
   - Age availability toggle: ❌ Hidden

4. **Overnight Camp with Multiple Age Groups:**
   - Half-day toggle: ❌ Hidden
   - Age pricing toggle: ✅ Visible
   - Age availability toggle: ✅ Visible

---

## 📝 Implementation Checklist

### Phase 1: Database Schema
- [ ] Update `Camp` model (remove `sessionType` field)
- [ ] Update `Session` model (remove flexible fields, add new fields)
- [ ] Add new enums (`SessionDayType`, `PricingType`, `AvailabilityType`, `SessionStatus`)
- [ ] Remove old enum (`SessionType`)
- [ ] Create and run migration
- [ ] Verify schema changes in database

### Phase 2: Backend API
- [ ] Delete flexible session DTOs
- [ ] Delete `update-session-type.dto.ts`
- [ ] Update `create-fixed-session.dto.ts` with new fields
- [ ] Update `update-fixed-session.dto.ts`
- [ ] Update `sessions.service.ts`:
  - [ ] Remove `getSessionType()`, `setSessionType()`
  - [ ] Remove `createFlexibleSession()`, `updateFlexibleSession()`
  - [ ] Update `createFixedSession()` with validation
  - [ ] Update `updateFixedSession()` with validation
  - [ ] Update `transformSessionForResponse()`
- [ ] Update `sessions.controller.ts`:
  - [ ] Remove session type endpoints
  - [ ] Remove flexible session endpoints
  - [ ] Update remaining endpoints
- [ ] Test all endpoints with Postman/Insomnia

### Phase 3: Frontend Types
- [ ] Update `wc-provider/src/types/sessions.ts`
- [ ] Update `wc-provider/src/services/sessions.service.ts`
- [ ] Update `wc-booking/src/types/sessions.ts`

### Phase 4: Frontend Components (wc-provider)
- [ ] Delete `SessionTypeSelector.tsx`
- [ ] Delete `flexible/` directory
- [ ] Update `index.ts` exports
- [ ] Update `SessionsPage.tsx`
- [ ] Rename fixed session components:
  - [ ] `FixedSessionsManager.tsx` → `SessionsManager.tsx`
  - [ ] `FixedSessionsList.tsx` → `SessionsList.tsx`
  - [ ] `FixedSessionCard.tsx` → `SessionCard.tsx`
  - [ ] `FixedSessionForm.tsx` → `SessionForm.tsx`
  - [ ] `FixedSessionsEmptyState.tsx` → `SessionsEmptyState.tsx`
- [ ] Implement new `SessionForm.tsx` with:
  - [ ] Session name and dates
  - [ ] Half-day toggle (conditional)
  - [ ] Time pickers (conditional)
  - [ ] Pricing section (single/age group)
  - [ ] Availability section (single/age group)
  - [ ] Status selector
  - [ ] Validation logic
- [ ] Update `useSessionsData.tsx` hook
- [ ] Update `useSessionMutations.tsx` hook

### Phase 4: Frontend Components (wc-booking)
- [ ] Update `SessionsSection.tsx` to remove flexible session handling
- [ ] Update session card display logic
- [ ] Test session display on camp detail page

### Phase 5: Testing
- [ ] Backend unit tests
- [ ] Backend integration tests
- [ ] Frontend component tests
- [ ] End-to-end tests
- [ ] Manual testing of all scenarios

---

## 🚨 Breaking Changes & Migration Notes

### Database Migration

**⚠️ WARNING:** This is a breaking change. Existing session data will be affected.

**Migration strategy:**

1. **Option A: Clear existing sessions** (recommended for development)
   ```sql
   DELETE FROM sessions;
   DELETE FROM bookings;
   ```

2. **Option B: Migrate existing fixed sessions** (for production)
   ```sql
   -- Migrate fixed sessions to new schema
   UPDATE sessions
   SET
     startDate = sessionStartDate,
     endDate = sessionEndDate,
     sessionType = 'full_day',
     pricingType = 'single',
     availabilityType = 'single',
     totalSpots = capacity,
     status = CASE WHEN isActive THEN 'published' ELSE 'draft' END
   WHERE type = 'fixed';

   -- Delete flexible sessions (cannot be migrated)
   DELETE FROM sessions WHERE type = 'flexible';
   ```

### API Changes

**Removed endpoints:**
- `GET /provider/camps/:campId/sessions/type`
- `PUT /provider/camps/:campId/sessions/type`
- `GET /provider/camps/:campId/sessions/flexible`
- `POST /provider/camps/:campId/sessions/flexible`
- `PUT /provider/camps/:campId/sessions/flexible/:sessionId`

**Updated endpoints:**
- `GET /provider/camps/:campId/sessions` - Now returns all sessions (no type filter)
- `POST /provider/camps/:campId/sessions` - Now uses `CreateFixedSessionDto`
- `PUT /provider/camps/:campId/sessions/:sessionId` - Now uses `UpdateFixedSessionDto`

**New endpoint:**
- `PATCH /provider/camps/:campId/sessions/:sessionId/status` - Toggle draft/published

### Frontend Changes

**Removed components:**
- `SessionTypeSelector`
- All flexible session components

**Renamed components:**
- `FixedSessionsManager` → `SessionsManager`
- `FixedSessionsList` → `SessionsList`
- `FixedSessionCard` → `SessionCard`
- `FixedSessionForm` → `SessionForm`
- `FixedSessionsEmptyState` → `SessionsEmptyState`

---

## 📚 Additional Resources

- **Design Reference:** `WC-Booking/Provider/Sessions/✅1-session-creation-dashboard_13.html`
- **Implementation Spec:** `WC-Booking/Provider/Sessions/1-session-creation-IMPLEMENTATION-SPECIFICATION.md`
- **Prisma Docs:** https://www.prisma.io/docs
- **NestJS Validation:** https://docs.nestjs.com/techniques/validation

---

## 🎯 Success Criteria

- [ ] All flexible session code removed
- [ ] Session type selection removed
- [ ] New session schema implemented
- [ ] Backend validation working correctly
- [ ] Frontend form matches design spec
- [ ] Conditional rendering working correctly
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Documentation updated

---

**End of Implementation Plan**


