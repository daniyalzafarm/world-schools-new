# Discounts Module Implementation Plan - Sessions Feature

## 📋 Overview

This document provides a complete, phased implementation plan for adding discount functionality to the Sessions feature in the wc-provider app. The implementation follows the exact design and business logic from the reference HTML files and developer handover documents.

### Key Features
- **Global Discounts**: Camp-level discounts that apply to all sessions by default
- **Session-Specific Discounts**: Manual discounts created per session
- **Age Group Targeting**: Conditional discount targeting based on age groups (when age pricing is active)
- **Flexible Removal**: Global discounts can be removed from individual sessions without affecting others

### Reference Materials
- `WC-Booking/Provider/Sessions/✅0-sessions-dashboard-final_6.html` - Session dashboard with discount UI
- `WC-Booking/Provider/Sessions/✅1-session-creation-dashboard_13.html` - Session creation with discounts
- `WC-Booking/Provider/Sessions/0-sessions-dashboard-final-DEVELOPER-HANDOVER.md` - Business rules
- `WC-Booking/Provider/Sessions/1-session-creation-IMPLEMENTATION-SPECIFICATION.md` - Technical specs

---

## 📑 Table of Contents

### 🗄️ [Phase 1: Database Schema Changes](#️-phase-1-database-schema-changes)
- [1.1 Create Global Discounts Table](#11-create-global-discounts-table)
- [1.2 Add Discounts Field to Sessions Table](#12-add-discounts-field-to-sessions-table)
- [1.3 Migration Script](#13-migration-script)
- [1.4 Database Seeding](#14-database-seeding)

### 🔧 [Phase 2: Backend Implementation](#-phase-2-backend-implementation)
- [2.1 DTOs (Data Transfer Objects)](#21-dtos-data-transfer-objects)
- [2.2 Session Discount DTOs](#22-session-discount-dtos)
- [2.3 API Endpoints - Global Discounts](#23-api-endpoints---global-discounts)
- [2.4 API Endpoints - Session Discounts](#24-api-endpoints---session-discounts)
- [2.5 Service Layer - Global Discounts](#25-service-layer---global-discounts)
- [2.6 Service Layer - Session Discounts](#26-service-layer---session-discounts)
- [2.7 Validation Rules Summary](#27-validation-rules-summary)

### 🎨 [Phase 3: Frontend Implementation](#-phase-3-frontend-implementation)
- [3.1 TypeScript Types](#31-typescript-types)
- [3.2 API Service Methods](#32-api-service-methods)
- [3.3 UI Components - Discount Form Modal](#33-ui-components---discount-form-modal)
- [3.4 UI Components - Discount Display in Session Detail Panel](#34-ui-components---discount-display-in-session-detail-panel)
- [3.5 UI Components - Manage Discounts Panel](#35-ui-components---manage-discounts-panel)
- [3.6 Integration Points](#36-integration-points)

### 📊 [Phase 4: Data Flow Documentation](#-phase-4-data-flow-documentation)
- [4.1 Global Discount Entry Management Flow](#41-global-discount-entry-management-flow)
- [4.2 Session Creation Flow](#42-session-creation-flow)
- [4.3 Global Discount Removal from Session Flow](#43-global-discount-removal-from-session-flow)
- [4.4 Session-Specific Discount Flow](#44-session-specific-discount-flow)
- [4.5 Global Discount Category Enable/Disable Flow](#45-global-discount-category-enabledisable-flow)

### 🚀 [Phase 5: Implementation Order](#-phase-5-implementation-order)
- [Step 1: Database & Backend Foundation](#step-1-database--backend-foundation)
- [Step 2: Frontend Types & Services](#step-2-frontend-types--services)
- [Step 3: UI Components](#step-3-ui-components)

### 📝 [Notes & Considerations](#-notes--considerations)

### 🎯 [Success Criteria](#-success-criteria)

---

## 🗄️ Phase 1: Database Schema Changes

### 1.1 Create Global Discounts Table

**New Table: `global_discounts`**

```prisma
model GlobalDiscount {
  id              String            @id @default(uuid())
  campId          String            @map("camp_id")

  // Discount Category
  category        DiscountCategory  // Type of discount (early_bird, sibling, etc.)

  // Entries Array - stores multiple discount configurations per category
  entries         Json              // Array of discount entries (see structure below)

  // Status
  isEnabled       Boolean           @default(false) @map("is_enabled") // Whether discount category is active
  sortOrder       Int               @default(0) @map("sort_order")

  // Metadata
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  // Relations
  camp            Camp              @relation(fields: [campId], references: [id], onDelete: Cascade)

  @@unique([campId, category]) // One discount record per category per camp
  @@index([campId])
  @@index([isEnabled])
  @@map("global_discounts")
}

enum DiscountCategory {
  early_bird        // Reward early bookings
  sibling           // Multiple children discounts
  returning_camper  // Loyalty discount
  multi_week        // Volume pricing & consecutive weeks
  group_booking     // Schools, clubs & organizations
  promo_code        // Custom promotional codes
}

enum CalculationType {
  percent
  fixed
}
```

**Entries JSON Structure:**

The `entries` field is a JSON array where each entry represents a complete discount configuration. The structure varies by category:

**Single-Entry Categories** (early_bird, sibling, returning_camper):
- These categories have one entry in the array
- The entry contains all configuration for that discount type

**Multiple-Entry Categories** (multi_week, group_booking, promo_code):
- These categories can have multiple entries in the array
- Each entry is an independent discount rule/tier/code
- Entries can be added, edited, or removed dynamically

```typescript
// EARLY BIRD - Single Entry
{
  entries: [
    {
      id: string              // Unique entry ID (e.g., "entry-1")
      name: string            // Display name (e.g., "Early Bird")
      value: number           // Discount value (e.g., 10)
      calculationType: 'percent' | 'fixed'
      validUntil: string      // ISO date string
      details?: string        // Optional description
    }
  ]
}

// SIBLING DISCOUNT - Single Entry
{
  entries: [
    {
      id: string              // Unique entry ID
      name: string            // Display name (e.g., "Sibling Discount")
      calculationType: 'percent'
      details?: string
      config: {
        secondChild: number   // Percentage for 2nd child (e.g., 10)
        thirdChild: number    // Percentage for 3rd child (e.g., 15)
        fourthPlusChild: number // Percentage for 4th+ child (e.g., 20)
      }
    }
  ]
}

// RETURNING CAMPER - Single Entry
{
  entries: [
    {
      id: string              // Unique entry ID
      name: string            // Display name (e.g., "Returning Camper")
      value: number           // Discount percentage (e.g., 5)
      calculationType: 'percent'
      details?: string
    }
  ]
}

// MULTI-WEEK BOOKING - Multiple Entries
{
  entries: [
    {
      id: string              // Unique entry ID (e.g., "entry-1")
      name: string            // Rule name (e.g., "2+ weeks: 10% off")
      value: number           // Discount value
      calculationType: 'percent' | 'fixed'
      details?: string
      config: {
        type: 'per_week' | 'fixed' | 'volume'
        minimumWeeks?: number       // For 'per_week' and 'fixed' types
        percentagePerWeek?: number  // For 'per_week' type
        fixedAmount?: number        // For 'fixed' type
        tiers?: {                   // For 'volume' type
          twoToNineWeeks: number
          tenPlusWeeks: number
        }
      }
    },
    {
      id: "entry-2"
      name: "5+ weeks: 20% off"
      value: 20
      calculationType: 'percent'
      config: {
        type: 'per_week'
        minimumWeeks: 5
        percentagePerWeek: 20
      }
    }
    // ... more entries
  ]
}

// GROUP BOOKING - Multiple Entries
{
  entries: [
    {
      id: string              // Unique entry ID
      name: string            // Tier name (e.g., "3-5 children: 10% off")
      value: number           // Discount percentage
      calculationType: 'percent'
      details?: string
      config: {
        minimumChildren: number  // Minimum children required (e.g., 3)
        maximumChildren?: number // Optional maximum (e.g., 5)
      }
    },
    {
      id: "entry-2"
      name: "6-10 children: 15% off"
      value: 15
      calculationType: 'percent'
      config: {
        minimumChildren: 6
        maximumChildren: 10
      }
    }
    // ... more tiers
  ]
}

// PROMO CODE - Multiple Entries
{
  entries: [
    {
      id: string              // Unique entry ID
      name: string            // Promo code (e.g., "SUMMER2026")
      value: number           // Discount value
      calculationType: 'percent' | 'fixed'
      validFrom?: string      // ISO date string
      validUntil?: string     // ISO date string
      details?: string
      config: {
        code: string          // The actual promo code
        usageLimit: number    // Maximum uses (e.g., 50)
        timesUsed: number     // Current usage count (e.g., 23)
      }
    },
    {
      id: "entry-2"
      name: "EARLYBIRD"
      value: 20
      calculationType: 'percent'
      validFrom: "2026-01-01"
      validUntil: "2026-05-01"
      config: {
        code: "EARLYBIRD"
        usageLimit: 100
        timesUsed: 45
      }
    }
    // ... more promo codes
  ]
}
```

### 1.2 Add Discounts Field to Sessions Table

**Update: `sessions` table**

```prisma
model Session {
  // ... existing fields ...

  // Discounts (JSON structure)
  discounts Json? // See structure below

  // ... rest of existing fields ...
}
```

**Discounts JSON Structure:**
```typescript
{
  globalApplied: string[]      // IDs of global discounts applied to this session
  globalRemoved: string[]      // IDs of global discounts removed from this session
  sessionSpecific: [           // Array of session-specific discount objects
    {
      id: string               // UUID
      name: string             // Max 30 chars
      type: 'percent' | 'fixed'
      value: number
      validUntil: string | null // ISO date string
      ageGroups: string[]      // Age group IDs (empty = all ages)
    }
  ]
}
```

### 1.3 Migration Script

**File:** `world-schools/apps/wc-nest-api/prisma/migrations/[timestamp]_add_discounts/migration.sql`

```sql
-- Create DiscountCategory enum
CREATE TYPE "DiscountCategory" AS ENUM (
    'early_bird',
    'sibling',
    'returning_camper',
    'multi_week',
    'group_booking',
    'promo_code'
);

-- Create CalculationType enum
CREATE TYPE "CalculationType" AS ENUM ('percent', 'fixed');

-- Create global_discounts table
CREATE TABLE "global_discounts" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "category" "DiscountCategory" NOT NULL,
    "entries" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_discounts_pkey" PRIMARY KEY ("id")
);

-- Add discounts column to sessions
ALTER TABLE "sessions" ADD COLUMN "discounts" JSONB;

-- Create indexes
CREATE INDEX "global_discounts_camp_id_idx" ON "global_discounts"("camp_id");
CREATE INDEX "global_discounts_is_enabled_idx" ON "global_discounts"("is_enabled");

-- Create unique constraint (one discount per category per camp)
CREATE UNIQUE INDEX "global_discounts_camp_id_category_key" ON "global_discounts"("camp_id", "category");

-- Add foreign key
ALTER TABLE "global_discounts" ADD CONSTRAINT "global_discounts_camp_id_fkey"
    FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 1.4 Database Seeding

**Purpose:** Initialize all 6 global discount types for each camp with `isEnabled: false` and default entries.

**File:** `world-schools/apps/wc-nest-api/prisma/seed.ts` (add to existing seed function)

```typescript
// Add this function to seed.ts
async function seedGlobalDiscounts(prisma: PrismaClient) {
  console.log('Seeding global discount types for all camps...')

  // Get all camps
  const camps = await prisma.camp.findMany({
    select: { id: true, name: true }
  })

  // Define the 6 discount types with default entries
  const discountTypes = [
    {
      category: 'early_bird',
      isEnabled: false,
      sortOrder: 1,
      entries: [
        {
          id: 'entry-1',
          name: 'Early Bird',
          value: 10,
          calculationType: 'percent',
          validUntil: null,
          details: 'Reward early bookings'
        }
      ]
    },
    {
      category: 'sibling',
      isEnabled: false,
      sortOrder: 2,
      entries: [
        {
          id: 'entry-1',
          name: 'Sibling Discount',
          calculationType: 'percent',
          details: 'Discounts for multiple children',
          config: {
            secondChild: 10,
            thirdChild: 15,
            fourthPlusChild: 20
          }
        }
      ]
    },
    {
      category: 'returning_camper',
      isEnabled: false,
      sortOrder: 3,
      entries: [
        {
          id: 'entry-1',
          name: 'Returning Camper',
          value: 5,
          calculationType: 'percent',
          details: 'Loyalty discount for returning campers'
        }
      ]
    },
    {
      category: 'multi_week',
      isEnabled: false,
      sortOrder: 4,
      entries: [] // Empty - camp directors will add their own rules
    },
    {
      category: 'group_booking',
      isEnabled: false,
      sortOrder: 5,
      entries: [] // Empty - camp directors will add their own tiers
    },
    {
      category: 'promo_code',
      isEnabled: false,
      sortOrder: 6,
      entries: [] // Empty - camp directors will add their own promo codes
    }
  ]

  let createdCount = 0
  let skippedCount = 0

  // Create discount types for each camp
  for (const camp of camps) {
    for (const discountType of discountTypes) {
      try {
        await prisma.globalDiscount.upsert({
          where: {
            campId_category: {
              campId: camp.id,
              category: discountType.category
            }
          },
          update: {}, // Never update existing records to preserve user configurations
          create: {
            campId: camp.id,
            category: discountType.category,
            entries: discountType.entries,
            isEnabled: discountType.isEnabled,
            sortOrder: discountType.sortOrder
          }
        })
        createdCount++
      } catch (error) {
        // Discount already exists, skip
        skippedCount++
      }
    }
  }

  console.log(`✅ Global discounts seeded: ${createdCount} created, ${skippedCount} skipped`)
}

// Add to main() function in seed.ts:
async function main() {
  // ... existing seed code ...

  // Seed global discount types
  await seedGlobalDiscounts(prisma)

  // ... rest of seed code ...
}
```

**Usage:**
```bash
# Run seeder after migration
cd world-schools/apps/wc-nest-api
npx prisma migrate dev
npm run seed
```

**Notes:**
- Seeder uses `upsert` with `update: {}` to only insert if doesn't exist
- Never updates existing discount records to preserve user configurations
- All discounts start with `isEnabled: false` - camp directors must enable them
- **Single-entry categories** (early_bird, sibling, returning_camper) are initialized with one default entry
- **Multiple-entry categories** (multi_week, group_booking, promo_code) are initialized with empty arrays
- Camp directors can customize entries after seeding through the Manage Discounts panel

---

## 🔧 Phase 2: Backend Implementation

### 2.1 DTOs (Data Transfer Objects)

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/discounts/dto/global-discount.dto.ts`

```typescript
import { IsString, IsEnum, IsNumber, IsOptional, MaxLength, Min, IsDateString, IsBoolean, IsObject, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export enum DiscountCategory {
  EARLY_BIRD = 'early_bird',
  SIBLING = 'sibling',
  RETURNING_CAMPER = 'returning_camper',
  MULTI_WEEK = 'multi_week',
  GROUP_BOOKING = 'group_booking',
  PROMO_CODE = 'promo_code',
}

export enum CalculationType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// DTO for individual discount entry
export class DiscountEntryDto {
  @IsString()
  id: string // Unique entry ID

  @IsString()
  @MaxLength(30)
  name: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString()
  validFrom?: string

  @IsOptional()
  @IsDateString()
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any> // Category-specific configuration
}

// DTO for updating the entire GlobalDiscount (category level)
export class UpdateGlobalDiscountDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountEntryDto)
  entries?: DiscountEntryDto[]

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean
}

// DTO for adding a new entry to a discount category
export class AddDiscountEntryDto {
  @IsString()
  @MaxLength(30)
  name: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString()
  validFrom?: string

  @IsOptional()
  @IsDateString()
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any>
}

// DTO for updating an existing entry
export class UpdateDiscountEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number

  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType

  @IsOptional()
  @IsDateString()
  validFrom?: string

  @IsOptional()
  @IsDateString()
  validUntil?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  details?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, any>
}
```

### 2.2 Session Discount DTOs

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/dto/session-discount.dto.ts`

```typescript
import { IsString, IsEnum, IsNumber, IsOptional, MaxLength, Min, IsArray, IsDateString, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'

export class SessionSpecificDiscountDto {
  @IsString()
  @MaxLength(30)
  name: string

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed'

  @IsNumber()
  @Min(0.01)
  value: number

  @IsOptional()
  @IsDateString()
  validUntil?: string | null

  @IsArray()
  @IsString({ each: true })
  ageGroups: string[] // Empty array = applies to all ages
}

export class AddSessionDiscountDto {
  @IsString()
  @MaxLength(30)
  name: string

  @IsEnum(['percent', 'fixed'])
  type: 'percent' | 'fixed'

  @IsNumber()
  @Min(0.01)
  value: number

  @IsOptional()
  @IsDateString()
  validUntil?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ageGroups?: string[]
}

export class RemoveGlobalDiscountDto {
  @IsUUID()
  globalDiscountId: string
}

export class ApplyGlobalDiscountDto {
  @IsUUID()
  globalDiscountId: string
}
```

### 2.3 API Endpoints - Global Discounts

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/discounts/discounts.controller.ts`

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { DiscountsService } from './discounts.service'
import { UpdateGlobalDiscountDto, AddDiscountEntryDto, UpdateDiscountEntryDto } from './dto/global-discount.dto'

@Controller('provider/camps/:campId/discounts')
@UseGuards(JwtAuthGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  /**
   * GET /provider/camps/:campId/discounts
   * Get all global discounts for a camp
   */
  @Get()
  async getGlobalDiscounts(@Param('campId') campId: string, @Request() req) {
    const providerId = req.user.providerId
    return this.discountsService.getGlobalDiscounts(campId, providerId)
  }

  /**
   * PUT /provider/camps/:campId/discounts/:discountId
   * Update a global discount (category level - entries array or isEnabled)
   */
  @Put(':discountId')
  async updateGlobalDiscount(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Body() dto: UpdateGlobalDiscountDto,
    @Request() req
  ) {
    const providerId = req.user.providerId
    return this.discountsService.updateGlobalDiscount(discountId, campId, providerId, dto)
  }

  /**
   * POST /provider/camps/:campId/discounts/:discountId/entries
   * Add a new entry to a discount category
   */
  @Post(':discountId/entries')
  async addDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Body() dto: AddDiscountEntryDto,
    @Request() req
  ) {
    const providerId = req.user.providerId
    return this.discountsService.addDiscountEntry(discountId, campId, providerId, dto)
  }

  /**
   * PUT /provider/camps/:campId/discounts/:discountId/entries/:entryId
   * Update an existing entry in a discount category
   */
  @Put(':discountId/entries/:entryId')
  async updateDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateDiscountEntryDto,
    @Request() req
  ) {
    const providerId = req.user.providerId
    return this.discountsService.updateDiscountEntry(discountId, entryId, campId, providerId, dto)
  }

  /**
   * DELETE /provider/camps/:campId/discounts/:discountId/entries/:entryId
   * Remove an entry from a discount category
   */
  @Delete(':discountId/entries/:entryId')
  async removeDiscountEntry(
    @Param('campId') campId: string,
    @Param('discountId') discountId: string,
    @Param('entryId') entryId: string,
    @Request() req
  ) {
    const providerId = req.user.providerId
    return this.discountsService.removeDiscountEntry(discountId, entryId, campId, providerId)
  }
}
```

### 2.4 API Endpoints - Session Discounts

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/sessions.controller.ts` (additions)

```typescript
// Add these endpoints to the existing SessionsController

/**
 * POST /provider/camps/:campId/sessions/:sessionId/discounts
 * Add a session-specific discount
 */
@Post(':sessionId/discounts')
async addSessionDiscount(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @Body() dto: AddSessionDiscountDto,
  @Request() req
) {
  const providerId = req.user.providerId
  return this.sessionsService.addSessionDiscount(sessionId, campId, providerId, dto)
}

/**
 * DELETE /provider/camps/:campId/sessions/:sessionId/discounts/:discountId
 * Remove a session-specific discount
 */
@Delete(':sessionId/discounts/:discountId')
async removeSessionDiscount(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @Param('discountId') discountId: string,
  @Request() req
) {
  const providerId = req.user.providerId
  return this.sessionsService.removeSessionDiscount(sessionId, campId, providerId, discountId)
}

/**
 * POST /provider/camps/:campId/sessions/:sessionId/discounts/global/remove
 * Remove a global discount from this session only
 */
@Post(':sessionId/discounts/global/remove')
async removeGlobalDiscountFromSession(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @Body() dto: RemoveGlobalDiscountDto,
  @Request() req
) {
  const providerId = req.user.providerId
  return this.sessionsService.removeGlobalDiscountFromSession(sessionId, campId, providerId, dto.globalDiscountId)
}

/**
 * POST /provider/camps/:campId/sessions/:sessionId/discounts/global/apply
 * Re-apply a previously removed global discount to this session
 */
@Post(':sessionId/discounts/global/apply')
async applyGlobalDiscountToSession(
  @Param('campId') campId: string,
  @Param('sessionId') sessionId: string,
  @Body() dto: ApplyGlobalDiscountDto,
  @Request() req
) {
  const providerId = req.user.providerId
  return this.sessionsService.applyGlobalDiscountToSession(sessionId, campId, providerId, dto.globalDiscountId)
}
```

### 2.5 Service Layer - Global Discounts

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/discounts/discounts.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '@/modules/prisma/prisma.service'
import { UpdateGlobalDiscountDto, AddDiscountEntryDto, UpdateDiscountEntryDto } from './dto/global-discount.dto'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verify camp ownership
   */
  private async verifyCampOwnership(campId: string, providerId: string) {
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: { providerId: true },
    })

    if (!camp) {
      throw new NotFoundException('Camp not found')
    }

    if (camp.providerId !== providerId) {
      throw new ForbiddenException('You do not have access to this camp')
    }
  }

  /**
   * Get all global discounts for a camp
   */
  async getGlobalDiscounts(campId: string, providerId: string) {
    await this.verifyCampOwnership(campId, providerId)

    return this.prisma.globalDiscount.findMany({
      where: { campId },
      orderBy: { sortOrder: 'asc' },
    })
  }

  /**
   * Update a global discount (category level)
   * Can update entries array or isEnabled flag
   */
  async updateGlobalDiscount(
    discountId: string,
    campId: string,
    providerId: string,
    dto: UpdateGlobalDiscountDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (!discount || discount.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: {
        ...(dto.entries !== undefined && { entries: dto.entries }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    })
  }

  /**
   * Add a new entry to a discount category
   */
  async addDiscountEntry(
    discountId: string,
    campId: string,
    providerId: string,
    dto: AddDiscountEntryDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (!discount || discount.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // Create new entry with unique ID
    const newEntry = {
      id: uuidv4(),
      ...dto,
    }

    // Add to entries array
    const updatedEntries = [...entries, newEntry]

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }

  /**
   * Update an existing entry in a discount category
   */
  async updateDiscountEntry(
    discountId: string,
    entryId: string,
    campId: string,
    providerId: string,
    dto: UpdateDiscountEntryDto
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (!discount || discount.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // Find entry index
    const entryIndex = entries.findIndex((e: any) => e.id === entryId)
    if (entryIndex === -1) {
      throw new NotFoundException('Entry not found')
    }

    // Update entry
    const updatedEntries = [...entries]
    updatedEntries[entryIndex] = {
      ...updatedEntries[entryIndex],
      ...dto,
    }

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }

  /**
   * Remove an entry from a discount category
   */
  async removeDiscountEntry(
    discountId: string,
    entryId: string,
    campId: string,
    providerId: string
  ) {
    await this.verifyCampOwnership(campId, providerId)

    const discount = await this.prisma.globalDiscount.findUnique({
      where: { id: discountId },
    })

    if (!discount || discount.campId !== campId) {
      throw new NotFoundException('Discount not found')
    }

    // Get current entries
    const entries = (discount.entries as any[]) || []

    // Filter out the entry
    const updatedEntries = entries.filter((e: any) => e.id !== entryId)

    if (updatedEntries.length === entries.length) {
      throw new NotFoundException('Entry not found')
    }

    // Update discount
    return this.prisma.globalDiscount.update({
      where: { id: discountId },
      data: { entries: updatedEntries },
    })
  }

    // Remove from all sessions
    await this.removeGlobalDiscountFromAllSessions(campId, discountId)

    // Delete the discount
    await this.prisma.globalDiscount.delete({
      where: { id: discountId },
    })

    return { success: true }
  }

  /**
   * Reorder global discounts
   */
  async reorderGlobalDiscounts(campId: string, providerId: string, discountIds: string[]) {
    await this.verifyCampOwnership(campId, providerId)

    // Update sort order for each discount
    const updates = discountIds.map((id, index) =>
      this.prisma.globalDiscount.update({
        where: { id },
        data: { sortOrder: index },
      })
    )

    await this.prisma.$transaction(updates)

    return { success: true }
  }

  /**
   * Helper: Apply global discount to all sessions
   */
  private async applyGlobalDiscountToAllSessions(campId: string, discountId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { campId },
    })

    const updates = sessions.map(session => {
      const discounts = (session.discounts as any) || { globalApplied: [], globalRemoved: [], sessionSpecific: [] }

      // Add to globalApplied if not already there
      if (!discounts.globalApplied.includes(discountId)) {
        discounts.globalApplied.push(discountId)
      }

      // Remove from globalRemoved if it was there
      discounts.globalRemoved = discounts.globalRemoved.filter((id: string) => id !== discountId)

      return this.prisma.session.update({
        where: { id: session.id },
        data: { discounts },
      })
    })

    await this.prisma.$transaction(updates)
  }

  /**
   * Helper: Remove global discount from all sessions
   */
  private async removeGlobalDiscountFromAllSessions(campId: string, discountId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { campId },
    })

    const updates = sessions.map(session => {
      const discounts = (session.discounts as any) || { globalApplied: [], globalRemoved: [], sessionSpecific: [] }

      // Remove from both arrays
      discounts.globalApplied = discounts.globalApplied.filter((id: string) => id !== discountId)
      discounts.globalRemoved = discounts.globalRemoved.filter((id: string) => id !== discountId)

      return this.prisma.session.update({
        where: { id: session.id },
        data: { discounts },
      })
    })

    await this.prisma.$transaction(updates)
  }
}
```


### 2.6 Service Layer - Session Discounts

**File:** `world-schools/apps/wc-nest-api/src/modules/provider/sessions/sessions.service.ts` (additions)

```typescript
// Add these methods to the existing SessionsService class

/**
 * Add a session-specific discount
 */
async addSessionDiscount(
  sessionId: string,
  campId: string,
  providerId: string,
  dto: AddSessionDiscountDto
) {
  await this.verifySessionOwnership(sessionId, campId, providerId)

  // Validate discount value
  if (dto.type === 'percent' && dto.value > 100) {
    throw new BadRequestException('Percentage discount cannot exceed 100%')
  }

  if (dto.value <= 0) {
    throw new BadRequestException('Discount value must be greater than 0')
  }

  // Get session and camp to validate age groups
  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
    include: { camp: true },
  })

  // Validate age groups if provided
  if (dto.ageGroups && dto.ageGroups.length > 0) {
    const campAgeGroups = session.camp.ageGroups as any[]
    const validAgeGroupIds = campAgeGroups.map((ag: any) => `${ag.min}-${ag.max}`)

    const invalidAgeGroups = dto.ageGroups.filter(id => !validAgeGroupIds.includes(id))
    if (invalidAgeGroups.length > 0) {
      throw new BadRequestException(`Invalid age group IDs: ${invalidAgeGroups.join(', ')}`)
    }
  }

  // Get current discounts
  const discounts = (session.discounts as any) || {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Create new discount object
  const newDiscount = {
    id: this.generateUUID(),
    name: dto.name,
    type: dto.type,
    value: dto.value,
    validUntil: dto.validUntil || null,
    ageGroups: dto.ageGroups || [],
  }

  // Add to session-specific discounts
  discounts.sessionSpecific.push(newDiscount)

  // Update session
  return this.prisma.session.update({
    where: { id: sessionId },
    data: { discounts },
  })
}

/**
 * Remove a session-specific discount
 */
async removeSessionDiscount(
  sessionId: string,
  campId: string,
  providerId: string,
  discountId: string
) {
  await this.verifySessionOwnership(sessionId, campId, providerId)

  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
  })

  const discounts = (session.discounts as any) || {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Remove the discount
  discounts.sessionSpecific = discounts.sessionSpecific.filter(
    (d: any) => d.id !== discountId
  )

  return this.prisma.session.update({
    where: { id: sessionId },
    data: { discounts },
  })
}

/**
 * Remove a global discount from this session only
 */
async removeGlobalDiscountFromSession(
  sessionId: string,
  campId: string,
  providerId: string,
  globalDiscountId: string
) {
  await this.verifySessionOwnership(sessionId, campId, providerId)

  // Verify the global discount exists and belongs to this camp
  const globalDiscount = await this.prisma.globalDiscount.findUnique({
    where: { id: globalDiscountId },
  })

  if (!globalDiscount || globalDiscount.campId !== campId) {
    throw new NotFoundException('Global discount not found')
  }

  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
  })

  const discounts = (session.discounts as any) || {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Remove from globalApplied
  discounts.globalApplied = discounts.globalApplied.filter(
    (id: string) => id !== globalDiscountId
  )

  // Add to globalRemoved if not already there
  if (!discounts.globalRemoved.includes(globalDiscountId)) {
    discounts.globalRemoved.push(globalDiscountId)
  }

  return this.prisma.session.update({
    where: { id: sessionId },
    data: { discounts },
  })
}

/**
 * Re-apply a previously removed global discount to this session
 */
async applyGlobalDiscountToSession(
  sessionId: string,
  campId: string,
  providerId: string,
  globalDiscountId: string
) {
  await this.verifySessionOwnership(sessionId, campId, providerId)

  // Verify the global discount exists and belongs to this camp
  const globalDiscount = await this.prisma.globalDiscount.findUnique({
    where: { id: globalDiscountId },
  })

  if (!globalDiscount || globalDiscount.campId !== campId) {
    throw new NotFoundException('Global discount not found')
  }

  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
  })

  const discounts = (session.discounts as any) || {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Add to globalApplied if not already there
  if (!discounts.globalApplied.includes(globalDiscountId)) {
    discounts.globalApplied.push(globalDiscountId)
  }

  // Remove from globalRemoved
  discounts.globalRemoved = discounts.globalRemoved.filter(
    (id: string) => id !== globalDiscountId
  )

  return this.prisma.session.update({
    where: { id: sessionId },
    data: { discounts },
  })
}

/**
 * Helper: Generate UUID (use existing UUID library)
 */
private generateUUID(): string {
  return crypto.randomUUID()
}
```

**Update session creation method:**

```typescript
async create(campId: string, providerId: string, dto: CreateSessionDto) {
  // ... existing validation code ...

  // Get all active global discounts for this camp
  const globalDiscounts = await this.prisma.globalDiscount.findMany({
    where: { campId, isActive: true },
    select: { id: true },
  })

  // Initialize discounts structure
  const discounts = {
    globalApplied: globalDiscounts.map(d => d.id),
    globalRemoved: [],
    sessionSpecific: [],
  }

  const session = await this.prisma.session.create({
    data: {
      campId,
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      sessionDayType: dto.sessionDayType,
      arrivalTime: dto.arrivalTime,
      departureTime: dto.departureTime,
      pricingType: dto.pricingType,
      price: dto.price,
      ageGroupPrices: dto.ageGroupPrices,
      availabilityType: dto.availabilityType,
      totalSpots: dto.totalSpots,
      ageGroupSpots: dto.ageGroupSpots,
      discounts, // Add discounts initialization
      status: 'draft',
    },
  })

  return session
}
```

### 2.7 Validation Rules Summary

**Business Rules Implementation:**

1. **Discount Value Validation:**
   - Percentage discounts: 0 < value ≤ 100
   - Fixed discounts: value > 0
   - Implemented in both DTOs and service layer

2. **Discount Name Validation:**
   - Max length: 30 characters
   - Required field
   - Implemented via `@MaxLength(30)` decorator

3. **Age Group Targeting:**
   - Only available when `camp.ageGroups.length >= 2 AND session.pricingType === 'age_group'`
   - Empty array = applies to all ages
   - Validated against camp's age groups
   - Implemented in `addSessionDiscount` method

4. **Global Discount Behavior:**
   - Auto-applied to all sessions on creation
   - Removal only affects specific session (tracked in `globalRemoved` array)
   - Deletion removes from all sessions
   - Implemented in `DiscountsService`

5. **Session Creation:**
   - All active global discounts automatically applied
   - Implemented in `SessionsService.create` method

---

## 🎨 Phase 3: Frontend Implementation

### 3.1 TypeScript Types

**File:** `world-schools/apps/wc-provider/src/types/discounts.ts` (new file)

```typescript
export type DiscountType = 'percent' | 'fixed'

export interface GlobalDiscount {
  id: string
  campId: string
  name: string
  type: DiscountType
  value: number
  details?: string
  validUntil?: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SessionSpecificDiscount {
  id: string
  name: string
  type: DiscountType
  value: number
  validUntil?: string | null
  ageGroups: string[] // Empty = applies to all ages
}

export interface SessionDiscounts {
  globalApplied: string[] // IDs of global discounts applied
  globalRemoved: string[] // IDs of global discounts removed
  sessionSpecific: SessionSpecificDiscount[]
}

export interface CreateGlobalDiscountDto {
  name: string
  type: DiscountType
  value: number
  details?: string
  validUntil?: string
}

export interface UpdateGlobalDiscountDto {
  name?: string
  type?: DiscountType
  value?: number
  details?: string
  validUntil?: string
  isActive?: boolean
}

export interface AddSessionDiscountDto {
  name: string
  type: DiscountType
  value: number
  validUntil?: string | null
  ageGroups?: string[]
}
```

**Update:** `world-schools/apps/wc-provider/src/types/sessions.ts`

```typescript
import type { SessionDiscounts } from './discounts'

export interface Session {
  // ... existing fields ...
  discounts?: SessionDiscounts
}

export interface CreateSessionDto {
  // ... existing fields ...
  // discounts will be auto-initialized by backend
}

export interface UpdateSessionDto {
  // ... existing fields ...
  discounts?: SessionDiscounts
}
```

### 3.2 API Service Methods

**File:** `world-schools/apps/wc-provider/src/services/discounts.service.ts` (new file)

```typescript
import type {
  GlobalDiscount,
  CreateGlobalDiscountDto,
  UpdateGlobalDiscountDto,
} from '@/types/discounts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export const discountsService = {
  /**
   * Get all global discounts for a camp
   */
  async getGlobalDiscounts(campId: string): Promise<GlobalDiscount[]> {
    const response = await fetch(`${API_BASE}/provider/camps/${campId}/discounts`, {
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Failed to fetch global discounts')
    return response.json()
  },

  /**
   * Create a new global discount
   */
  async createGlobalDiscount(
    campId: string,
    data: CreateGlobalDiscountDto
  ): Promise<GlobalDiscount> {
    const response = await fetch(`${API_BASE}/provider/camps/${campId}/discounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to create global discount')
    return response.json()
  },

  /**
   * Update a global discount
   */
  async updateGlobalDiscount(
    campId: string,
    discountId: string,
    data: UpdateGlobalDiscountDto
  ): Promise<GlobalDiscount> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/discounts/${discountId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    )
    if (!response.ok) throw new Error('Failed to update global discount')
    return response.json()
  },

  /**
   * Delete a global discount
   */
  async deleteGlobalDiscount(campId: string, discountId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/discounts/${discountId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )
    if (!response.ok) throw new Error('Failed to delete global discount')
  },

  /**
   * Reorder global discounts
   */
  async reorderGlobalDiscounts(campId: string, discountIds: string[]): Promise<void> {
    const response = await fetch(`${API_BASE}/provider/camps/${campId}/discounts/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ discountIds }),
    })
    if (!response.ok) throw new Error('Failed to reorder global discounts')
  },
}
```

**Update:** `world-schools/apps/wc-provider/src/services/sessions.service.ts`

```typescript
import type { AddSessionDiscountDto } from '@/types/discounts'

// Add these methods to the existing sessionsService object

export const sessionsService = {
  // ... existing methods ...

  /**
   * Add a session-specific discount
   */
  async addSessionDiscount(
    campId: string,
    sessionId: string,
    data: AddSessionDiscountDto
  ): Promise<Session> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/sessions/${sessionId}/discounts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }
    )
    if (!response.ok) throw new Error('Failed to add session discount')
    return response.json()
  },

  /**
   * Remove a session-specific discount
   */
  async removeSessionDiscount(
    campId: string,
    sessionId: string,
    discountId: string
  ): Promise<Session> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/sessions/${sessionId}/discounts/${discountId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )
    if (!response.ok) throw new Error('Failed to remove session discount')
    return response.json()
  },

  /**
   * Remove a global discount from this session
   */
  async removeGlobalDiscountFromSession(
    campId: string,
    sessionId: string,
    globalDiscountId: string
  ): Promise<Session> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/sessions/${sessionId}/discounts/global/remove`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ globalDiscountId }),
      }
    )
    if (!response.ok) throw new Error('Failed to remove global discount from session')
    return response.json()
  },

  /**
   * Re-apply a global discount to this session
   */
  async applyGlobalDiscountToSession(
    campId: string,
    sessionId: string,
    globalDiscountId: string
  ): Promise<Session> {
    const response = await fetch(
      `${API_BASE}/provider/camps/${campId}/sessions/${sessionId}/discounts/global/apply`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ globalDiscountId }),
      }
    )
    if (!response.ok) throw new Error('Failed to apply global discount to session')
    return response.json()
  },
}
```


### 3.3 UI Components - Discount Form Modal

**File:** `world-schools/apps/wc-provider/src/components/sessions/DiscountFormModal.tsx` (new file)

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
} from '@heroui/react'
import { Input, CurrencyInput, CheckboxButton } from '@world-schools/ui-web'
import type { AddSessionDiscountDto, SessionSpecificDiscount } from '@/types/discounts'
import type { AgeGroup } from '@/types/camps'

interface DiscountFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: AddSessionDiscountDto) => Promise<void>
  ageGroups: AgeGroup[]
  showAgeGroupSelector: boolean // Only show when camp has 2+ age groups AND pricing is age_group
  editDiscount?: SessionSpecificDiscount | null
  currency: string
}

export function DiscountFormModal({
  isOpen,
  onClose,
  onSubmit,
  ageGroups,
  showAgeGroupSelector,
  editDiscount,
  currency,
}: DiscountFormModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState<number>(0)
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form when editing
  useEffect(() => {
    if (editDiscount) {
      setName(editDiscount.name)
      setType(editDiscount.type)
      setValue(editDiscount.value)
      setSelectedAgeGroups(editDiscount.ageGroups || [])
    } else {
      // Reset form
      setName('')
      setType('percent')
      setValue(0)
      setSelectedAgeGroups([])
    }
    setErrors({})
  }, [editDiscount, isOpen])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Discount name is required'
    } else if (name.length > 30) {
      newErrors.name = 'Discount name must be 30 characters or less'
    }

    if (value <= 0) {
      newErrors.value = 'Discount value must be greater than 0'
    }

    if (type === 'percent' && value > 100) {
      newErrors.value = 'Percentage discount cannot exceed 100%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        value,
        ageGroups: selectedAgeGroups,
      })
      onClose()
    } catch (error) {
      console.error('Failed to save discount:', error)
      setErrors({ submit: 'Failed to save discount. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAgeGroup = (ageGroupId: string) => {
    setSelectedAgeGroups(prev =>
      prev.includes(ageGroupId)
        ? prev.filter(id => id !== ageGroupId)
        : [...prev, ageGroupId]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>
          {editDiscount ? 'Edit Discount' : 'Add Session Discount'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            {/* Discount Name */}
            <Input
              label="Discount Name"
              placeholder="e.g., Early Bird, Sibling Discount"
              value={name}
              onChange={e => setName(e.target.value)}
              isRequired
              errorMessage={errors.name}
              isInvalid={!!errors.name}
              maxLength={30}
            />

            {/* Discount Type */}
            <Select
              label="Discount Type"
              selectedKeys={[type]}
              onSelectionChange={keys => setType(Array.from(keys)[0] as 'percent' | 'fixed')}
              isRequired
              labelPlacement="outside"
            >
              <SelectItem key="percent">Percentage (%)</SelectItem>
              <SelectItem key="fixed">Fixed Amount ({currency})</SelectItem>
            </Select>

            {/* Discount Value */}
            {type === 'percent' ? (
              <Input
                label="Discount Percentage"
                type="number"
                value={value.toString()}
                onChange={e => setValue(parseFloat(e.target.value) || 0)}
                isRequired
                errorMessage={errors.value}
                isInvalid={!!errors.value}
                endContent={<span className="text-gray-500">%</span>}
                min={0}
                max={100}
                step={1}
              />
            ) : (
              <CurrencyInput
                label="Discount Amount"
                value={value}
                onChange={setValue}
                currency={currency}
                isRequired
                errorMessage={errors.value}
                isInvalid={!!errors.value}
              />
            )}

            {/* Age Group Selector - Conditional */}
            {showAgeGroupSelector && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Apply to Age Groups (optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Leave empty to apply to all age groups
                </p>
                <div className="flex flex-wrap gap-2">
                  {ageGroups.map(ag => {
                    const ageGroupId = `${ag.min}-${ag.max}`
                    return (
                      <CheckboxButton
                        key={ageGroupId}
                        label={`${ag.min}-${ag.max} years`}
                        selected={selectedAgeGroups.includes(ageGroupId)}
                        onPress={() => toggleAgeGroup(ageGroupId)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors.submit && (
              <div className="text-sm text-danger">{errors.submit}</div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            {editDiscount ? 'Save Changes' : 'Add Discount'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
```


### 3.4 UI Components - Discount Display in Session Detail Panel

**File:** `world-schools/apps/wc-provider/src/components/sessions/SessionDiscountsSection.tsx` (new file)

```typescript
'use client'

import { useState } from 'react'
import { Button, Chip } from '@heroui/react'
import { Plus, X, RotateCcw } from 'lucide-react'
import type { Session } from '@/types/sessions'
import type { GlobalDiscount } from '@/types/discounts'
import type { Camp } from '@/types/camps'
import { DiscountFormModal } from './DiscountFormModal'
import { sessionsService } from '@/services/sessions.service'

interface SessionDiscountsSectionProps {
  session: Session
  camp: Camp
  globalDiscounts: GlobalDiscount[]
  onUpdate: () => void
}

export function SessionDiscountsSection({
  session,
  camp,
  globalDiscounts,
  onUpdate,
}: SessionDiscountsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const discounts = session.discounts || {
    globalApplied: [],
    globalRemoved: [],
    sessionSpecific: [],
  }

  // Determine which global discounts are applied
  const appliedGlobalDiscounts = globalDiscounts.filter(gd =>
    discounts.globalApplied.includes(gd.id)
  )

  // Determine which global discounts are removed
  const removedGlobalDiscounts = globalDiscounts.filter(gd =>
    discounts.globalRemoved.includes(gd.id)
  )

  // Check if age group selector should be shown
  const showAgeGroupSelector =
    camp.ageGroups.length >= 2 && session.pricingType === 'age_group'

  const handleAddDiscount = async (data: AddSessionDiscountDto) => {
    await sessionsService.addSessionDiscount(camp.id, session.id, data)
    onUpdate()
  }

  const handleRemoveSessionDiscount = async (discountId: string) => {
    await sessionsService.removeSessionDiscount(camp.id, session.id, discountId)
    onUpdate()
  }

  const handleRemoveGlobalDiscount = async (globalDiscountId: string) => {
    await sessionsService.removeGlobalDiscountFromSession(
      camp.id,
      session.id,
      globalDiscountId
    )
    onUpdate()
  }

  const handleReapplyGlobalDiscount = async (globalDiscountId: string) => {
    await sessionsService.applyGlobalDiscountToSession(
      camp.id,
      session.id,
      globalDiscountId
    )
    onUpdate()
  }

  const formatDiscountValue = (type: string, value: number) => {
    return type === 'percent' ? `${value}%` : `${camp.currency} ${value}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Discounts</h3>
        <Button
          size="sm"
          color="primary"
          variant="light"
          startContent={<Plus size={16} />}
          onPress={() => setIsModalOpen(true)}
        >
          Add Discount
        </Button>
      </div>

      {/* Global Discounts - Applied */}
      {appliedGlobalDiscounts.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Global Discounts</p>
          <div className="space-y-2">
            {appliedGlobalDiscounts.map(gd => (
              <div
                key={gd.id}
                className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">{gd.name}</p>
                  <p className="text-xs text-gray-600">
                    {formatDiscountValue(gd.type, gd.value)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  isIconOnly
                  onPress={() => handleRemoveGlobalDiscount(gd.id)}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Discounts - Removed (can be re-applied) */}
      {removedGlobalDiscounts.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Removed Global Discounts</p>
          <div className="space-y-2">
            {removedGlobalDiscounts.map(gd => (
              <div
                key={gd.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg opacity-60"
              >
                <div>
                  <p className="text-sm font-medium line-through">{gd.name}</p>
                  <p className="text-xs text-gray-600">
                    {formatDiscountValue(gd.type, gd.value)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  isIconOnly
                  onPress={() => handleReapplyGlobalDiscount(gd.id)}
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session-Specific Discounts */}
      {discounts.sessionSpecific.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Session-Specific Discounts</p>
          <div className="space-y-2">
            {discounts.sessionSpecific.map(sd => (
              <div
                key={sd.id}
                className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{sd.name}</p>
                    {sd.ageGroups.length > 0 && (
                      <Chip size="sm" variant="flat">
                        {sd.ageGroups.join(', ')} yrs
                      </Chip>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {formatDiscountValue(sd.type, sd.value)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  isIconOnly
                  onPress={() => handleRemoveSessionDiscount(sd.id)}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {appliedGlobalDiscounts.length === 0 && discounts.sessionSpecific.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No discounts applied to this session
        </p>
      )}

      {/* Discount Form Modal */}
      <DiscountFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddDiscount}
        ageGroups={camp.ageGroups}
        showAgeGroupSelector={showAgeGroupSelector}
        currency={camp.currency}
      />
    </div>
  )
}
```

### 3.5 UI Components - Manage Discounts Panel

**Purpose:** Dedicated panel for managing all 6 global discount types at the camp level.

**File:** `world-schools/apps/wc-provider/src/components/sessions/ManageDiscountsPanel.tsx` (new file)

```typescript
'use client'

import { useState } from 'react'
import { Button, Input, Select, SelectItem, Switch } from '@heroui/react'
import { X } from 'lucide-react'
import type { GlobalDiscount, DiscountCategory } from '@/types/discounts'
import { useDiscounts } from '@/services/discounts.service'

interface ManageDiscountsPanelProps {
  campId: string
  onClose: () => void
}

export function ManageDiscountsPanel({ campId, onClose }: ManageDiscountsPanelProps) {
  const {
    globalDiscounts,
    updateGlobalDiscount,
    addDiscountEntry,
    updateDiscountEntry,
    removeDiscountEntry,
    isLoading
  } = useDiscounts(campId)
  const [expandedSections, setExpandedSections] = useState<Set<DiscountCategory>>(new Set())

  const toggleSection = (category: DiscountCategory) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedSections(newExpanded)
  }

  const handleToggleDiscount = async (discount: GlobalDiscount) => {
    await updateGlobalDiscount(discount.id, {
      isEnabled: !discount.isEnabled
    })
  }

  const handleAddEntry = async (discountId: string, entry: any) => {
    await addDiscountEntry(discountId, entry)
  }

  const handleUpdateEntry = async (discountId: string, entryId: string, entry: any) => {
    await updateDiscountEntry(discountId, entryId, entry)
  }

  const handleRemoveEntry = async (discountId: string, entryId: string) => {
    await removeDiscountEntry(discountId, entryId)
  }

  // Get discount by category
  const getDiscount = (category: DiscountCategory) => {
    return globalDiscounts.find(d => d.category === category)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Discounts</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Discount Types
        </div>

        {/* Early Bird Discount - Single Entry */}
        <DiscountSection
          title="Early Bird"
          icon="🎯"
          description="Reward early bookings"
          discount={getDiscount('early_bird')}
          isExpanded={expandedSections.has('early_bird')}
          onToggleSection={() => toggleSection('early_bird')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={false}
        >
          <EarlyBirdFields
            discount={getDiscount('early_bird')}
            onUpdateEntry={handleUpdateEntry}
          />
        </DiscountSection>

        {/* Sibling Discount - Single Entry */}
        <DiscountSection
          title="Sibling Discount"
          icon="👨‍👩‍👧‍👦"
          description="Discounts for multiple children"
          discount={getDiscount('sibling')}
          isExpanded={expandedSections.has('sibling')}
          onToggleSection={() => toggleSection('sibling')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={false}
        >
          <SiblingFields
            discount={getDiscount('sibling')}
            onUpdateEntry={handleUpdateEntry}
          />
        </DiscountSection>

        {/* Returning Camper - Single Entry */}
        <DiscountSection
          title="Returning Camper"
          icon="🔄"
          description="Loyalty discount"
          discount={getDiscount('returning_camper')}
          isExpanded={expandedSections.has('returning_camper')}
          onToggleSection={() => toggleSection('returning_camper')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={false}
        >
          <ReturningCamperFields
            discount={getDiscount('returning_camper')}
            onUpdateEntry={handleUpdateEntry}
          />
        </DiscountSection>

        {/* Multi-Week Booking - Multiple Entries */}
        <DiscountSection
          title="Multi-Week Booking"
          icon="📅"
          description="Volume pricing & consecutive weeks"
          discount={getDiscount('multi_week')}
          isExpanded={expandedSections.has('multi_week')}
          onToggleSection={() => toggleSection('multi_week')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={true}
        >
          <MultiWeekFields
            discount={getDiscount('multi_week')}
            onAddEntry={handleAddEntry}
            onUpdateEntry={handleUpdateEntry}
            onRemoveEntry={handleRemoveEntry}
          />
        </DiscountSection>

        {/* Group Booking - Multiple Entries */}
        <DiscountSection
          title="Group Booking"
          icon="👥"
          description="Schools, clubs & organizations"
          discount={getDiscount('group_booking')}
          isExpanded={expandedSections.has('group_booking')}
          onToggleSection={() => toggleSection('group_booking')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={true}
        >
          <GroupBookingFields
            discount={getDiscount('group_booking')}
            onAddEntry={handleAddEntry}
            onUpdateEntry={handleUpdateEntry}
            onRemoveEntry={handleRemoveEntry}
          />
        </DiscountSection>

        {/* Promo Codes - Multiple Entries */}
        <DiscountSection
          title="Promo Codes"
          icon="🎟️"
          description="Custom promotional codes"
          discount={getDiscount('promo_code')}
          isExpanded={expandedSections.has('promo_code')}
          onToggleSection={() => toggleSection('promo_code')}
          onToggleEnabled={handleToggleDiscount}
          onAddEntry={handleAddEntry}
          onUpdateEntry={handleUpdateEntry}
          onRemoveEntry={handleRemoveEntry}
          allowMultipleEntries={true}
        >
          <PromoCodeFields
            discount={getDiscount('promo_code')}
            onAddEntry={handleAddEntry}
            onUpdateEntry={handleUpdateEntry}
            onRemoveEntry={handleRemoveEntry}
          />
        </DiscountSection>

        {/* Save Button */}
        <Button
          color="primary"
          className="w-full mt-4"
          isLoading={isLoading}
        >
          Save All Discounts
        </Button>
      </div>
    </div>
  )
}

// Reusable Discount Section Component
interface DiscountSectionProps {
  title: string
  icon: string
  description: string
  discount?: GlobalDiscount
  isExpanded: boolean
  onToggleSection: () => void
  onToggleEnabled: (discount: GlobalDiscount) => void
  onAddEntry: (discountId: string, entry: any) => void
  onUpdateEntry: (discountId: string, entryId: string, entry: any) => void
  onRemoveEntry: (discountId: string, entryId: string) => void
  allowMultipleEntries: boolean
  children: React.ReactNode
}

function DiscountSection({
  title,
  icon,
  description,
  discount,
  isExpanded,
  onToggleSection,
  onToggleEnabled,
  children
}: DiscountSectionProps) {
  if (!discount) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggleSection}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-left">
            <div className="font-medium">{title}</div>
            <div className="text-sm text-gray-500">{description}</div>
          </div>
        </div>
        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 space-y-3">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Enable {title.toLowerCase()}</span>
            <Switch
              isSelected={discount.isEnabled}
              onValueChange={() => onToggleEnabled(discount)}
            />
          </div>

          {/* Configuration Fields */}
          {discount.isEnabled && (
            <div className="space-y-3 pt-2">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Type-specific field components - Single Entry Categories
// These components work with the first entry in the entries array

function EarlyBirdFields({ discount, onUpdateEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const entry = entries[0] || {}

  const handleUpdate = (field: string, value: any) => {
    const updatedEntry = { ...entry, [field]: value }
    onUpdateEntry(discount.id, entry.id, updatedEntry)
  }

  return (
    <>
      <Input
        label="Discount Name"
        value={entry.name || 'Early Bird Discount'}
        onChange={(e) => handleUpdate('name', e.target.value)}
        maxLength={30}
      />
      <Input
        label="Discount %"
        type="number"
        value={entry.value || 10}
        onChange={(e) => handleUpdate('value', Number(e.target.value))}
      />
      <Input
        label="Valid until"
        type="date"
        value={entry.validUntil || ''}
        onChange={(e) => handleUpdate('validUntil', e.target.value)}
      />
      <Input
        label="Details (optional)"
        value={entry.details || ''}
        onChange={(e) => handleUpdate('details', e.target.value)}
        placeholder="e.g., Book 30 days in advance"
      />
    </>
  )
}

function SiblingFields({ discount, onUpdateEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const entry = entries[0] || {}
  const config = entry.config || {}

  const handleUpdate = (field: string, value: any) => {
    const updatedEntry = { ...entry, [field]: value }
    onUpdateEntry(discount.id, entry.id, updatedEntry)
  }

  const handleConfigUpdate = (configField: string, value: any) => {
    const updatedEntry = {
      ...entry,
      config: { ...config, [configField]: value }
    }
    onUpdateEntry(discount.id, entry.id, updatedEntry)
  }

  return (
    <>
      <Input
        label="Discount Name"
        value={entry.name || 'Sibling Discount'}
        onChange={(e) => handleUpdate('name', e.target.value)}
        maxLength={30}
      />
      <div className="grid grid-cols-3 gap-2">
        <Input
          label="2nd child %"
          type="number"
          value={config.secondChild || 10}
          onChange={(e) => handleConfigUpdate('secondChild', Number(e.target.value))}
        />
        <Input
          label="3rd child %"
          type="number"
          value={config.thirdChild || 15}
          onChange={(e) => handleConfigUpdate('thirdChild', Number(e.target.value))}
        />
        <Input
          label="4th+ child %"
          type="number"
          value={config.fourthPlusChild || 20}
          onChange={(e) => handleConfigUpdate('fourthPlusChild', Number(e.target.value))}
        />
      </div>
      <Input
        label="Details (optional)"
        value={entry.details || ''}
        onChange={(e) => handleUpdate('details', e.target.value)}
        placeholder="e.g., Applies to all age groups"
      />
    </>
  )
}

function ReturningCamperFields({ discount, onUpdateEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const entry = entries[0] || {}

  const handleUpdate = (field: string, value: any) => {
    const updatedEntry = { ...entry, [field]: value }
    onUpdateEntry(discount.id, entry.id, updatedEntry)
  }

  return (
    <>
      <Input
        label="Discount Name"
        value={entry.name || 'Returning Camper Discount'}
        onChange={(e) => handleUpdate('name', e.target.value)}
        maxLength={30}
      />
      <Input
        label="Discount %"
        type="number"
        value={entry.value || 5}
        onChange={(e) => handleUpdate('value', Number(e.target.value))}
      />
      <Input
        label="Details (optional)"
        value={entry.details || ''}
        onChange={(e) => handleUpdate('details', e.target.value)}
        placeholder="e.g., For campers who attended last year"
      />
    </>
  )
}

// Type-specific field components - Multiple Entry Categories
// These components display a list of entries with add/edit/remove functionality

function MultiWeekFields({ discount, onAddEntry, onUpdateEntry, onRemoveEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newEntry, setNewEntry] = useState<any>({
    name: '',
    value: 10,
    calculationType: 'percent',
    config: { minimumWeeks: 2 }
  })

  const handleAddEntry = () => {
    onAddEntry(discount.id, newEntry)
    setNewEntry({
      name: '',
      value: 10,
      calculationType: 'percent',
      config: { minimumWeeks: 2 }
    })
  }

  return (
    <div className="space-y-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => (
        <div key={entry.id} className="border border-gray-200 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{entry.name}</span>
            <button
              onClick={() => onRemoveEntry(discount.id, entry.id)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-600">
            {entry.calculationType === 'percent' ? `${entry.value}%` : `$${entry.value}`} off
            {entry.config?.minimumWeeks && ` for ${entry.config.minimumWeeks}+ weeks`}
          </div>
          {entry.details && (
            <div className="text-xs text-gray-500">{entry.details}</div>
          )}
        </div>
      ))}

      {/* Add New Entry Form */}
      <div className="border-2 border-dashed border-gray-300 rounded p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">Add New Rule</div>
        <Input
          label="Rule Name"
          value={newEntry.name}
          onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
          placeholder="e.g., 2+ weeks get 10%"
          maxLength={30}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Minimum Weeks"
            type="number"
            value={newEntry.config.minimumWeeks}
            onChange={(e) => setNewEntry({
              ...newEntry,
              config: { ...newEntry.config, minimumWeeks: Number(e.target.value) }
            })}
          />
          <Input
            label="Discount %"
            type="number"
            value={newEntry.value}
            onChange={(e) => setNewEntry({ ...newEntry, value: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Details (optional)"
          value={newEntry.details || ''}
          onChange={(e) => setNewEntry({ ...newEntry, details: e.target.value })}
          placeholder="e.g., Consecutive weeks only"
        />
        <Button
          size="sm"
          color="primary"
          onClick={handleAddEntry}
          isDisabled={!newEntry.name}
        >
          + Add Rule
        </Button>
      </div>
    </div>
  )
}

function GroupBookingFields({ discount, onAddEntry, onUpdateEntry, onRemoveEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const [newEntry, setNewEntry] = useState<any>({
    name: '',
    value: 15,
    calculationType: 'percent',
    config: { minimumChildren: 3 }
  })

  const handleAddEntry = () => {
    onAddEntry(discount.id, newEntry)
    setNewEntry({
      name: '',
      value: 15,
      calculationType: 'percent',
      config: { minimumChildren: 3 }
    })
  }

  return (
    <div className="space-y-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => (
        <div key={entry.id} className="border border-gray-200 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{entry.name}</span>
            <button
              onClick={() => onRemoveEntry(discount.id, entry.id)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-600">
            {entry.value}% off for {entry.config?.minimumChildren}+ children
          </div>
          {entry.details && (
            <div className="text-xs text-gray-500">{entry.details}</div>
          )}
        </div>
      ))}

      {/* Add New Entry Form */}
      <div className="border-2 border-dashed border-gray-300 rounded p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">Add New Tier</div>
        <Input
          label="Tier Name"
          value={newEntry.name}
          onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
          placeholder="e.g., 3-5 children: 10%"
          maxLength={30}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Minimum Children"
            type="number"
            value={newEntry.config.minimumChildren}
            onChange={(e) => setNewEntry({
              ...newEntry,
              config: { ...newEntry.config, minimumChildren: Number(e.target.value) }
            })}
          />
          <Input
            label="Discount %"
            type="number"
            value={newEntry.value}
            onChange={(e) => setNewEntry({ ...newEntry, value: Number(e.target.value) })}
          />
        </div>
        <Input
          label="Details (optional)"
          value={newEntry.details || ''}
          onChange={(e) => setNewEntry({ ...newEntry, details: e.target.value })}
          placeholder="e.g., For schools and clubs"
        />
        <Button
          size="sm"
          color="primary"
          onClick={handleAddEntry}
          isDisabled={!newEntry.name}
        >
          + Add Tier
        </Button>
      </div>
    </div>
  )
}

function PromoCodeFields({ discount, onAddEntry, onUpdateEntry, onRemoveEntry }: any) {
  if (!discount) return null

  const entries = (discount.entries as any[]) || []
  const [newEntry, setNewEntry] = useState<any>({
    name: '',
    value: 15,
    calculationType: 'percent',
    validFrom: '',
    validUntil: '',
    config: { code: '', usageLimit: 50 }
  })

  const handleAddEntry = () => {
    onAddEntry(discount.id, newEntry)
    setNewEntry({
      name: '',
      value: 15,
      calculationType: 'percent',
      validFrom: '',
      validUntil: '',
      config: { code: '', usageLimit: 50 }
    })
  }

  return (
    <div className="space-y-3">
      {/* Existing Entries */}
      {entries.map((entry: any) => (
        <div key={entry.id} className="border border-gray-200 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">{entry.name}</span>
              <span className="ml-2 text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                {entry.config?.code}
              </span>
            </div>
            <button
              onClick={() => onRemoveEntry(discount.id, entry.id)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-gray-600">
            {entry.value}% off • Valid: {entry.validFrom} to {entry.validUntil}
          </div>
          <div className="text-xs text-gray-500">
            Usage limit: {entry.config?.usageLimit || 'Unlimited'}
          </div>
          {entry.details && (
            <div className="text-xs text-gray-500">{entry.details}</div>
          )}
        </div>
      ))}

      {/* Add New Entry Form */}
      <div className="border-2 border-dashed border-gray-300 rounded p-3 space-y-2">
        <div className="text-sm font-medium text-gray-700">Add New Promo Code</div>
        <Input
          label="Promo Name"
          value={newEntry.name}
          onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
          placeholder="e.g., Summer 2026 Promo"
          maxLength={30}
        />
        <Input
          label="Promo Code"
          value={newEntry.config.code}
          onChange={(e) => setNewEntry({
            ...newEntry,
            config: { ...newEntry.config, code: e.target.value.toUpperCase() }
          })}
          placeholder="e.g., SUMMER2026"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Discount %"
            type="number"
            value={newEntry.value}
            onChange={(e) => setNewEntry({ ...newEntry, value: Number(e.target.value) })}
          />
          <Input
            label="Usage Limit"
            type="number"
            value={newEntry.config.usageLimit}
            onChange={(e) => setNewEntry({
              ...newEntry,
              config: { ...newEntry.config, usageLimit: Number(e.target.value) }
            })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Valid From"
            type="date"
            value={newEntry.validFrom}
            onChange={(e) => setNewEntry({ ...newEntry, validFrom: e.target.value })}
          />
          <Input
            label="Valid Until"
            type="date"
            value={newEntry.validUntil}
            onChange={(e) => setNewEntry({ ...newEntry, validUntil: e.target.value })}
          />
        </div>
        <Input
          label="Details (optional)"
          value={newEntry.details || ''}
          onChange={(e) => setNewEntry({ ...newEntry, details: e.target.value })}
          placeholder="e.g., Limited time offer"
        />
        <Button
          size="sm"
          color="primary"
          onClick={handleAddEntry}
          isDisabled={!newEntry.name || !newEntry.config.code}
        >
          + Add Promo Code
        </Button>
      </div>
    </div>
  )
}
```

**Usage:**
```typescript
// In Sessions Dashboard page
const [showManageDiscounts, setShowManageDiscounts] = useState(false)

// Trigger from header button
<button onClick={() => setShowManageDiscounts(true)}>
  % {/* Manage Discounts icon */}
</button>

{showManageDiscounts && (
  <ManageDiscountsPanel
    campId={campId}
    onClose={() => setShowManageDiscounts(false)}
  />
)}
```

### 3.6 Integration Points

**Update SessionDetailPanel to include discounts:**

```typescript
// In world-schools/apps/wc-provider/src/components/sessions/SessionDetailPanel.tsx

import { SessionDiscountsSection } from './SessionDiscountsSection'

// Add to the panel sections:
<SessionDiscountsSection
  session={selectedSession}
  camp={camp}
  globalDiscounts={globalDiscounts}
  onUpdate={refetchSessions}
/>
```

**Update SessionForm to show discount preview during creation:**

```typescript
// In world-schools/apps/wc-provider/src/components/sessions/SessionForm.tsx

// Add a read-only section showing which global discounts will be applied
<div className="space-y-2">
  <h3 className="text-sm font-semibold">Discounts (Auto-Applied)</h3>
  <p className="text-xs text-gray-500">
    The following global discounts will be automatically applied to this session:
  </p>
  {globalDiscounts.filter(gd => gd.isActive).map(gd => (
    <Chip key={gd.id} size="sm" variant="flat">
      {gd.name} - {gd.type === 'percent' ? `${gd.value}%` : `${currency} ${gd.value}`}
    </Chip>
  ))}
</div>
```

---

## 📊 Phase 4: Data Flow Documentation

### 4.1 Global Discount Entry Management Flow

**Adding a new entry to a discount category:**

1. **Provider clicks "+ Add Entry"** in ManageDiscountsPanel (e.g., for Multi-Week Booking)
2. **Provider fills form** with entry details (name, value, config)
3. **Frontend calls** → POST `/provider/camps/:campId/discounts/:discountId/entries`
   ```json
   {
     "name": "2+ weeks get 10%",
     "value": 10,
     "calculationType": "percent",
     "config": { "minimumWeeks": 2 },
     "details": "Consecutive weeks only"
   }
   ```
4. **Backend:**
   - Generates unique entry ID (UUID)
   - Adds entry to `entries` array
   - Updates GlobalDiscount record
5. **Frontend refreshes** → New entry appears in the list

**Updating an existing entry:**

1. **Provider edits entry** in ManageDiscountsPanel
2. **Frontend calls** → PUT `/provider/camps/:campId/discounts/:discountId/entries/:entryId`
   ```json
   {
     "value": 15,
     "details": "Updated description"
   }
   ```
3. **Backend:**
   - Finds entry by ID in `entries` array
   - Updates entry fields
   - Saves GlobalDiscount record
4. **Frontend refreshes** → Entry shows updated values

**Removing an entry:**

1. **Provider clicks "X"** on entry
2. **Frontend calls** → DELETE `/provider/camps/:campId/discounts/:discountId/entries/:entryId`
3. **Backend:**
   - Filters out entry from `entries` array
   - Saves GlobalDiscount record
4. **Frontend refreshes** → Entry removed from list

### 4.2 Session Creation Flow

1. **Provider creates new session** → POST `/provider/camps/:campId/sessions`
2. **Backend fetches enabled global discounts** for the camp (where `isEnabled = true`)
3. **Backend initializes session with discounts:**
   ```json
   {
     "globalApplied": ["discount-id-1", "discount-id-2"],
     "globalRemoved": [],
     "sessionSpecific": []
   }
   ```
4. **Frontend displays session** with global discounts already applied
5. **Note:** All entries within enabled discount categories are available for the session

### 4.3 Global Discount Removal from Session Flow

1. **Provider clicks remove** on global discount in session detail panel
2. **Frontend calls** → POST `/provider/camps/:campId/sessions/:sessionId/discounts/global/remove`
3. **Backend updates session:**
   - Removes discount ID from `globalApplied` array
   - Adds discount ID to `globalRemoved` array
4. **Frontend refreshes** → Discount shown as "removed" with option to re-apply
5. **Other sessions unaffected** → Still have the global discount applied
6. **Note:** Removing a discount category removes all its entries from the session

### 4.4 Session-Specific Discount Flow

1. **Provider adds session discount** → POST `/provider/camps/:campId/sessions/:sessionId/discounts`
2. **Backend validates:**
   - Discount value (0 < percent ≤ 100, fixed > 0)
   - Age groups (if provided, must exist in camp)
3. **Backend adds to session:**
   - Generates UUID for discount
   - Adds to `discounts.sessionSpecific` array
4. **Frontend refreshes** → New discount appears in session-specific section

### 4.5 Global Discount Category Enable/Disable Flow

1. **Provider toggles "Enable" switch** in ManageDiscountsPanel
2. **Frontend calls** → PUT `/provider/camps/:campId/discounts/:discountId`
   ```json
   {
     "isEnabled": true
   }
   ```
3. **Backend updates GlobalDiscount record**
4. **Frontend refreshes** → Discount category enabled/disabled
5. **Note:** Disabling a category doesn't delete entries, just prevents them from being applied to new sessions

---

## 🚀 Phase 5: Implementation Order

### Step 1: Database & Backend Foundation
1. Create and run Prisma migration
2. Run database seeder to initialize global discount types
3. Create DTOs and types
4. Create DiscountsService
5. Create DiscountsController
6. Update SessionsService with discount methods
7. Update SessionsController with discount endpoints

### Step 2: Frontend Types & Services
1. Create discount types (`types/discounts.ts`)
2. Update session types
3. Create discounts service (`services/discounts.service.ts`)
4. Update sessions service with discount methods

### Step 3: UI Components
1. Create DiscountFormModal component
2. Create SessionDiscountsSection component
3. Update SessionDetailPanel to include discounts
4. Update SessionForm to show global discount preview
5. Create Manage Discounts panel component

---

## 📝 Notes & Considerations

1. **Currency Handling:** Discount amounts use the camp's currency setting
2. **Age Group IDs:** Formatted as `"min-max"` (e.g., `"6-12"`)
3. **Backward Compatibility:** Existing sessions without discounts field will have `null`, handle gracefully
4. **Performance:** Global discount operations update all sessions - consider batch updates for camps with many sessions
5. **UI/UX:** Follow existing sessions UI patterns for consistency
6. **Validation:** Both frontend and backend validation for security
7. **Error Handling:** Proper error messages for all failure scenarios

---

## 🎯 Success Criteria

- ✅ Global discounts can be created, updated, deleted, and reordered
- ✅ Global discounts automatically apply to all sessions
- ✅ Global discounts can be removed from individual sessions without affecting others
- ✅ Session-specific discounts can be added and removed
- ✅ Age group targeting works when conditions are met
- ✅ All validation rules enforced on both frontend and backend
- ✅ UI matches reference HTML designs
- ✅ All business rules from handover documents implemented correctly
- ✅ Comprehensive test coverage
- ✅ No breaking changes to existing sessions functionality

---

**End of Implementation Plan**
