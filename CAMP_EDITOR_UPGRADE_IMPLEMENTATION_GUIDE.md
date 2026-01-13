# Camp Editor Upgrade Implementation Guide

**Version:** 1.0  
**Date:** 2026-01-13  
**Scope:** Activity Editors, What's Included, Daily Schedule, Add-ons (Excludes Sessions)

---

## Table of Contents

1. [Overview](#overview)
2. [Activity Editors Upgrade (15 Sections)](#activity-editors-upgrade)
3. [What's Included Enhancement](#whats-included-enhancement)
4. [Daily Schedule Enhancement](#daily-schedule-enhancement)
5. [Add-ons Editor Implementation](#add-ons-editor-implementation)
6. [Backend Integration Requirements](#backend-integration-requirements)
7. [Implementation Checklist](#implementation-checklist)

---

## Overview

### Current State vs Target State

**Current Implementation:**
- All activity editors use simple `Card` + `Textarea` UI
- Generic `updateSection()` backend method
- No structured DTOs or validation
- Data stored as unstructured JSON
- No auto-save indicators
- No character counters

**Target Implementation:**
- Rich grid-based UI with predefined options
- Activity selection grids with icons
- Facilities/equipment grids
- Custom activity input fields
- Character counters (1200 char limit)
- Auto-save indicators
- Structured DTOs with validation
- Type-safe frontend-backend contract

### Affected Files Summary

**Frontend (React/Next.js):**
- 15 activity editor pages in `world-schools/apps/wc-provider/src/app/camps/[id]/edit/`
- 1 What's Included page
- 1 Daily Schedule page
- 1 Add-ons page (new)

**Backend (NestJS):**
- DTOs in `world-schools/apps/wc-nest-api/src/modules/provider/camps/dto/`
- Service methods in `camps.service.ts`
- Controller endpoints in `camps.controller.ts`

---

## Activity Editors Upgrade

### 1. Sports Activities Editor

**File:** `world-schools/apps/wc-provider/src/app/camps/[id]/edit/sports/page.tsx`

#### Current State
```tsx
// Simple textarea with no structure
<Textarea
  label="Sports Activities"
  placeholder="Describe the sports activities..."
  value={sports}
  onValueChange={handleChange}
  minRows={8}
/>
```

#### Target State Structure

**Reference:** `WC-Booking/Camp Dashboard/Editor/7-sports-activities-editor.html`

**Key Components:**
1. **Description Textarea** (1200 char limit)
2. **Skill Level Radio Group** (All Levels / Beginner-Intermediate / Advanced)
3. **Coaching Type Radio Group** (Recreational / Competitive / Both)
4. **Sports Grid** (Predefined sports with icons)
5. **Custom Sports Input** (Add custom sports)
6. **Facilities Grid** (Optional - sports facilities)
7. **Auto-save Indicator**
8. **Character Counter**

#### Implementation Steps

**Step 1: Create Shared Components**

Create reusable components in `world-schools/apps/wc-provider/src/components/camp-editor/`:

```tsx
// components/camp-editor/ActivityGrid.tsx
interface ActivityGridProps {
  activities: Array<{ id: string; name: string; icon: string }>
  selectedActivities: string[]
  onToggle: (id: string) => void
  maxSelection?: number
}

export function ActivityGrid({ activities, selectedActivities, onToggle, maxSelection }: ActivityGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {activities.map((activity) => {
        const isSelected = selectedActivities.includes(activity.id)
        const canSelect = !maxSelection || selectedActivities.length < maxSelection || isSelected

        return (
          <button
            key={activity.id}
            type="button"
            onClick={() => canSelect && onToggle(activity.id)}
            className={`
              flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
              ${isSelected
                ? 'border-primary bg-primary-light'
                : 'border-gray-200 bg-white hover:border-primary hover:bg-gray-50'
              }
              ${!canSelect && !isSelected ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
          >
            <span className="text-3xl">{activity.icon}</span>
            <span className="text-sm font-medium text-gray-900">{activity.name}</span>
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
// components/camp-editor/CharacterCounter.tsx
interface CharacterCounterProps {
  current: number
  max: number
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  const percentage = (current / max) * 100
  const isNearLimit = percentage >= 90
  const isOverLimit = current > max

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-gray-500'}`}>
        {current}
      </span>
      <span className="text-gray-400">/</span>
      <span className="text-gray-500">{max}</span>
    </div>
  )
}
```

```tsx
// components/camp-editor/AutoSaveIndicator.tsx
interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <span className="text-gray-600">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-gray-600">All changes saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-red-600">Failed to save</span>
        </>
      )}
    </div>
  )
}
```

```tsx
// components/camp-editor/CustomActivityInput.tsx
interface CustomActivityInputProps {
  placeholder: string
  onAdd: (value: string) => void
  buttonText?: string
}

export function CustomActivityInput({ placeholder, onAdd, buttonText = 'Add' }: CustomActivityInputProps) {
  const [value, setValue] = useState('')

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim())
      setValue('')
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        className="flex-1"
      />
      <Button onClick={handleAdd} color="primary">
        {buttonText}
      </Button>
    </div>
  )
}
```

**Step 2: Create Sports Data Constants**

```tsx
// constants/sports-activities.ts
export const PREDEFINED_SPORTS = [
  { id: 'soccer', name: 'Soccer', icon: '⚽' },
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'tennis', name: 'Tennis', icon: '🎾' },
  { id: 'golf', name: 'Golf', icon: '⛳' },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐' },
  { id: 'swimming', name: 'Swimming', icon: '🏊' },
  { id: 'football', name: 'Football', icon: '🏈' },
  { id: 'baseball', name: 'Baseball', icon: '⚾' },
  { id: 'ping-pong', name: 'Ping Pong', icon: '🏓' },
  { id: 'archery', name: 'Archery', icon: '🎯' },
  { id: 'badminton', name: 'Badminton', icon: '🏸' },
  { id: 'cricket', name: 'Cricket', icon: '🏏' },
  { id: 'hockey', name: 'Hockey', icon: '🏑' },
  { id: 'rugby', name: 'Rugby', icon: '🏉' },
  { id: 'skiing', name: 'Skiing', icon: '⛷️' },
  { id: 'snowboarding', name: 'Snowboarding', icon: '🏂' },
]

export const SPORTS_FACILITIES = [
  { id: 'soccer-field', name: 'Soccer Field', icon: '⚽' },
  { id: 'basketball-court', name: 'Basketball Court', icon: '🏀' },
  { id: 'tennis-court', name: 'Tennis Court', icon: '🎾' },
  { id: 'swimming-pool', name: 'Swimming Pool', icon: '🏊' },
  { id: 'gym', name: 'Gymnasium', icon: '🏋️' },
  { id: 'track', name: 'Running Track', icon: '🏃' },
  { id: 'climbing-wall', name: 'Climbing Wall', icon: '🧗' },
]

export const SKILL_LEVELS = [
  { value: 'all', label: 'All Levels Welcome', description: 'Beginners to advanced' },
  { value: 'beginner-intermediate', label: 'Beginner-Intermediate', description: 'No advanced training' },
  { value: 'advanced', label: 'Advanced Only', description: 'Requires prior experience' },
]

export const COACHING_TYPES = [
  { value: 'recreational', label: 'Recreational', description: 'Fun and skill building' },
  { value: 'competitive', label: 'Competitive', description: 'Tournament focused' },
  { value: 'both', label: 'Recreational & Competitive', description: 'Both options available' },
]
```

**Step 3: Update Sports Page Component**

```tsx
// app/camps/[id]/edit/sports/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Textarea, RadioGroup, Radio } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { ActivityGrid } from '../../../../../components/camp-editor/ActivityGrid'
import { CharacterCounter } from '../../../../../components/camp-editor/CharacterCounter'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { CustomActivityInput } from '../../../../../components/camp-editor/CustomActivityInput'
import { PREDEFINED_SPORTS, SPORTS_FACILITIES, SKILL_LEVELS, COACHING_TYPES } from '../../../../../constants/sports-activities'

const MAX_DESCRIPTION_LENGTH = 1200

interface SportsData {
  description: string
  skillLevel: string
  coachingType: string
  selectedSports: string[]
  customSports: string[]
  facilities: string[]
}

export default function SportsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [sportsData, setSportsData] = useState<SportsData>({
    description: '',
    skillLevel: 'all',
    coachingType: 'both',
    selectedSports: [],
    customSports: [],
    facilities: [],
  })

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.sportsActivities) {
      setSportsData({
        description: currentCamp.sportsActivities.description || '',
        skillLevel: currentCamp.sportsActivities.skillLevel || 'all',
        coachingType: currentCamp.sportsActivities.coachingType || 'both',
        selectedSports: currentCamp.sportsActivities.selectedSports || [],
        customSports: currentCamp.sportsActivities.customSports || [],
        facilities: currentCamp.sportsActivities.facilities || [],
      })
    }
  }, [currentCamp])

  // Auto-save handler
  const triggerAutoSave = (updatedData: SportsData) => {
    setHasUnsavedChanges(true)

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'sports', { sportsActivities: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)

        // Hide indicator after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save sports data:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleDescriptionChange = (value: string) => {
    const updated = { ...sportsData, description: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const handleSkillLevelChange = (value: string) => {
    const updated = { ...sportsData, skillLevel: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const handleCoachingTypeChange = (value: string) => {
    const updated = { ...sportsData, coachingType: value }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const toggleSport = (sportId: string) => {
    const updated = {
      ...sportsData,
      selectedSports: sportsData.selectedSports.includes(sportId)
        ? sportsData.selectedSports.filter(id => id !== sportId)
        : [...sportsData.selectedSports, sportId]
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const addCustomSport = (sportName: string) => {
    const updated = {
      ...sportsData,
      customSports: [...sportsData.customSports, sportName]
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const removeCustomSport = (index: number) => {
    const updated = {
      ...sportsData,
      customSports: sportsData.customSports.filter((_, i) => i !== index)
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  const toggleFacility = (facilityId: string) => {
    const updated = {
      ...sportsData,
      facilities: sportsData.facilities.includes(facilityId)
        ? sportsData.facilities.filter(id => id !== facilityId)
        : [...sportsData.facilities, facilityId]
    }
    setSportsData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Sports Activities</h1>
          <p className="text-sm text-gray-600">
            Describe the sports programs and facilities at your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-6">
        {/* Description */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between">
              <label className="text-sm font-semibold text-gray-900">
                Sports Program Description
              </label>
              <CharacterCounter
                current={sportsData.description.length}
                max={MAX_DESCRIPTION_LENGTH}
              />
            </div>
            <Textarea
              placeholder="Describe your sports program, coaching approach, equipment provided, and what makes it special..."
              value={sportsData.description}
              onValueChange={handleDescriptionChange}
              minRows={6}
              maxLength={MAX_DESCRIPTION_LENGTH}
              classNames={{
                input: 'resize-none',
              }}
            />
            <p className="text-xs text-gray-500">
              Include details about coaching staff, skill development, and competitive opportunities
            </p>
          </CardBody>
        </Card>

        {/* Skill Level */}
        <Card>
          <CardBody>
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-900">Skill Level</label>
              <p className="mt-1 text-xs text-gray-500">
                What skill levels can participate? This helps parents know if the program is right for their child.
              </p>
            </div>
            <RadioGroup
              value={sportsData.skillLevel}
              onValueChange={handleSkillLevelChange}
            >
              {SKILL_LEVELS.map((level) => (
                <Radio key={level.value} value={level.value}>
                  <div>
                    <div className="font-medium text-gray-900">{level.label}</div>
                    <div className="text-xs text-gray-500">{level.description}</div>
                  </div>
                </Radio>
              ))}
            </RadioGroup>
          </CardBody>
        </Card>

        {/* Coaching Type */}
        <Card>
          <CardBody>
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-900">Coaching Type</label>
              <p className="mt-1 text-xs text-gray-500">
                Is your program recreational fun or competitive training focused?
              </p>
            </div>
            <RadioGroup
              value={sportsData.coachingType}
              onValueChange={handleCoachingTypeChange}
            >
              {COACHING_TYPES.map((type) => (
                <Radio key={type.value} value={type.value}>
                  <div>
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </Radio>
              ))}
            </RadioGroup>
          </CardBody>
        </Card>

        {/* Sports Offered */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-900">
                  Sports & Activities Offered
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Select all sports available at your camp. This makes your camp searchable by specific sports.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {sportsData.selectedSports.length} selected
              </span>
            </div>

            <ActivityGrid
              activities={PREDEFINED_SPORTS}
              selectedActivities={sportsData.selectedSports}
              onToggle={toggleSport}
            />

            {/* Custom Sports */}
            {sportsData.customSports.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sportsData.customSports.map((sport, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-lg border-2 border-primary bg-primary-light px-3 py-2"
                  >
                    <span className="text-sm font-medium">{sport}</span>
                    <button
                      type="button"
                      onClick={() => removeCustomSport(index)}
                      className="text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <CustomActivityInput
              placeholder="e.g., Rock Climbing, Horseback Riding..."
              onAdd={addCustomSport}
              buttonText="Add Sport"
            />
          </CardBody>
        </Card>

        {/* Facilities */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-900">
                  Sports Facilities
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Select the sports facilities available at your camp
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {sportsData.facilities.length} selected
              </span>
            </div>

            <ActivityGrid
              activities={SPORTS_FACILITIES}
              selectedActivities={sportsData.facilities}
              onToggle={toggleFacility}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
```

---

### 2. All Other Activity Editors (14 Sections)

The following sections follow the same pattern as Sports, with different activity lists:

#### Activity Sections to Upgrade

| Section | File Path | Predefined Activities | Additional Fields |
|---------|-----------|----------------------|-------------------|
| **Languages** | `/languages/page.tsx` | English, Spanish, French, German, Mandarin, etc. | Language proficiency levels |
| **Arts & Crafts** | `/arts/page.tsx` | Painting, Drawing, Sculpture, Pottery, etc. | Art supplies provided |
| **Adventure** | `/adventure/page.tsx` | Hiking, Camping, Rock Climbing, Kayaking, etc. | Safety certifications |
| **Water Activities** | `/water/page.tsx` | Swimming, Kayaking, Sailing, Surfing, etc. | Lifeguard certifications |
| **Environmental** | `/environmental/page.tsx` | Nature Walks, Wildlife Study, Gardening, etc. | Sustainability focus |
| **Academics** | `/academics/page.tsx` | Math, Science, Reading, Writing, etc. | Academic level |
| **Religion** | `/religion/page.tsx` | Prayer Times, Religious Studies, etc. | Denomination |
| **Excursions** | `/excursions/page.tsx` | Museum Visits, City Tours, Theme Parks, etc. | Transportation included |
| **Location & Campus** | `/location-campus/page.tsx` | Classrooms, Dorms, Dining Hall, etc. | Campus size |
| **Accommodation** | `/accommodation/page.tsx` | Cabins, Dorms, Tents, etc. | Room capacity |
| **Getting There** | `/getting-there/page.tsx` | Airport Pickup, Bus Service, etc. | Transportation cost |
| **Camp Focus** | `/camp-focus/page.tsx` | Sports, Arts, STEM, Leadership, etc. | Primary focus |
| **Meals** | `/meals/page.tsx` | Breakfast, Lunch, Dinner, Snacks | Dietary options |

#### Implementation Template for Each Section

**Step 1:** Create constants file for each section

```tsx
// constants/[section]-activities.ts
export const PREDEFINED_[SECTION] = [
  { id: 'item-1', name: 'Item 1', icon: '🎨' },
  // ... more items
]

export const [SECTION]_OPTIONS = [
  { value: 'option1', label: 'Option 1', description: 'Description' },
  // ... more options
]
```

**Step 2:** Copy the Sports page structure and adapt:
- Replace `PREDEFINED_SPORTS` with section-specific constants
- Replace `SPORTS_FACILITIES` with section-specific facilities (if applicable)
- Replace `SKILL_LEVELS` and `COACHING_TYPES` with section-specific options
- Update field names in `SportsData` interface to match section

**Step 3:** Update backend DTO (see Backend Integration section)

---

## What's Included Enhancement

**File:** `world-schools/apps/wc-provider/src/app/camps/[id]/edit/whats-included/page.tsx`

**Reference:** `WC-Booking/Camp Dashboard/Editor/3-whats-included-editor_6.html`

### Current State vs Target State

**Current:**
```tsx
<Textarea
  label="What's Included"
  placeholder="List everything that's included..."
  value={whatsIncluded}
  onValueChange={handleChange}
/>
```

**Target:**
- **Auto-Generated Section:** Items pulled from other sections (accommodation, meals, sports)
- **Manual Section:** Custom inclusions with emoji icons
- **Selection Limit:** Max 12 items total
- **Features:** Toggle selection, add/delete custom items, character limit (150 chars per item)

### Implementation Steps

**Step 1: Create Types**

```tsx
// types/whats-included.ts
export interface InclusionItem {
  id: string
  text: string
  icon: string
  source?: string // e.g., "Accommodation section"
  isAutoGenerated: boolean
  isSelected: boolean
}

export interface WhatsIncludedData {
  autoGenerated: InclusionItem[]
  manual: InclusionItem[]
}
```

**Step 2: Create Auto-Generation Logic**

```tsx
// utils/generate-inclusions.ts
import { Camp } from '../types/camp'

export function generateAutoInclusions(camp: Camp): InclusionItem[] {
  const inclusions: InclusionItem[] = []

  // From Accommodation
  if (camp.accommodation?.roomType) {
    inclusions.push({
      id: 'auto-accommodation',
      text: `${camp.accommodation.roomType} accommodation`,
      icon: '🏠',
      source: 'Accommodation section',
      isAutoGenerated: true,
      isSelected: true,
    })
  }

  // From Meals
  if (camp.meals?.mealsPerDay) {
    inclusions.push({
      id: 'auto-meals',
      text: `${camp.meals.mealsPerDay} meals daily`,
      icon: '🍽️',
      source: 'Meals & Dietary section',
      isAutoGenerated: true,
      isSelected: true,
    })
  }

  // From Sports
  if (camp.sportsActivities?.selectedSports?.length > 0) {
    inclusions.push({
      id: 'auto-sports',
      text: 'Daily sports coaching and activities',
      icon: '⚽',
      source: 'Sports section',
      isAutoGenerated: true,
      isSelected: true,
    })
  }

  // From Arts
  if (camp.artsActivities?.selectedArts?.length > 0) {
    inclusions.push({
      id: 'auto-arts',
      text: 'Arts and crafts materials',
      icon: '🎨',
      source: 'Arts section',
      isAutoGenerated: true,
      isSelected: true,
    })
  }

  // From Languages
  if (camp.languagePrograms?.selectedLanguages?.length > 0) {
    inclusions.push({
      id: 'auto-languages',
      text: 'Language instruction',
      icon: '🗣️',
      source: 'Languages section',
      isAutoGenerated: true,
      isSelected: true,
    })
  }

  return inclusions
}
```

**Step 3: Update Component**

```tsx
// app/camps/[id]/edit/whats-included/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Input, Button } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { generateAutoInclusions } from '../../../../../utils/generate-inclusions'
import type { InclusionItem, WhatsIncludedData } from '../../../../../types/whats-included'

const MAX_INCLUSIONS = 12
const MAX_ITEM_LENGTH = 150

export default function WhatsIncludedEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [data, setData] = useState<WhatsIncludedData>({
    autoGenerated: [],
    manual: [],
  })

  const [newItemText, setNewItemText] = useState('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load and generate inclusions
  useEffect(() => {
    if (currentCamp) {
      const autoGenerated = generateAutoInclusions(currentCamp)

      setData({
        autoGenerated,
        manual: currentCamp.whatsIncluded?.manual || [],
      })
    }
  }, [currentCamp])

  // Calculate total selected
  const totalSelected = [
    ...data.autoGenerated.filter(item => item.isSelected),
    ...data.manual.filter(item => item.isSelected),
  ].length

  // Auto-save handler
  const triggerAutoSave = (updatedData: WhatsIncludedData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'whats-included', { whatsIncluded: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)

        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const toggleAutoGenerated = (id: string) => {
    const updated = {
      ...data,
      autoGenerated: data.autoGenerated.map(item =>
        item.id === id ? { ...item, isSelected: !item.isSelected } : item
      ),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const toggleManual = (id: string) => {
    const updated = {
      ...data,
      manual: data.manual.map(item =>
        item.id === id ? { ...item, isSelected: !item.isSelected } : item
      ),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const addManualItem = () => {
    if (!newItemText.trim()) return

    if (totalSelected >= MAX_INCLUSIONS) {
      alert(`Maximum ${MAX_INCLUSIONS} items can be selected. Deselect an item first.`)
      return
    }

    const newItem: InclusionItem = {
      id: `manual-${Date.now()}`,
      text: newItemText.trim(),
      icon: '✓',
      isAutoGenerated: false,
      isSelected: true,
    }

    const updated = {
      ...data,
      manual: [...data.manual, newItem],
    }

    setData(updated)
    setNewItemText('')
    triggerAutoSave(updated)
  }

  const deleteManualItem = (id: string) => {
    const updated = {
      ...data,
      manual: data.manual.filter(item => item.id !== id),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const updateManualItemText = (id: string, text: string) => {
    const updated = {
      ...data,
      manual: data.manual.map(item =>
        item.id === id ? { ...item, text } : item
      ),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">What's Included</h1>
          <p className="text-sm text-gray-600">
            Choose up to 12 items to display on your camp profile
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-6">
        {/* Auto-Generated Section */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">From Your Camp Details</h3>
                <p className="mt-1 text-xs text-gray-500">
                  These items are pulled from other sections and selected by default. Click to unselect any you don't want to show.
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                Auto-Generated
              </span>
            </div>

            {data.autoGenerated.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">
                  Complete other sections (Accommodation, Meals, Sports, etc.) to auto-generate inclusions
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.autoGenerated.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleAutoGenerated(item.id)}
                    className={`
                      flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left transition-all
                      ${item.isSelected
                        ? 'border-primary bg-primary-light'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.text}</div>
                      <div className="text-xs text-gray-500">From: {item.source}</div>
                    </div>
                    {item.isSelected && (
                      <span className="text-primary">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Manual Section */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Additional Inclusions</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add services, care, equipment, or anything else included in your camp fee
                </p>
              </div>
              <span className={`
                rounded-full px-3 py-1 text-xs font-medium
                ${totalSelected >= MAX_INCLUSIONS
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
                }
              `}>
                {totalSelected} of {MAX_INCLUSIONS} selected
              </span>
            </div>

            {/* Manual Items List */}
            {data.manual.length > 0 && (
              <div className="space-y-2">
                {data.manual.map((item) => (
                  <div
                    key={item.id}
                    className={`
                      flex items-start gap-3 rounded-lg border-2 p-3 transition-all
                      ${item.isSelected
                        ? 'border-primary bg-primary-light'
                        : 'border-gray-200 bg-white'
                      }
                    `}
                  >
                    <button
                      type="button"
                      onClick={() => toggleManual(item.id)}
                      className="text-2xl"
                    >
                      {item.icon}
                    </button>
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => updateManualItemText(item.id, e.target.value)}
                      maxLength={MAX_ITEM_LENGTH}
                      className="flex-1 border-none bg-transparent font-medium text-gray-900 outline-none"
                      placeholder="Type inclusion..."
                    />
                    <button
                      type="button"
                      onClick={() => deleteManualItem(item.id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Item */}
            <div className="flex gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="e.g., Camp t-shirt and welcome pack, Certificate of participation..."
                maxLength={MAX_ITEM_LENGTH}
                onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
                className="flex-1"
              />
              <Button
                onClick={addManualItem}
                color="primary"
                isDisabled={!newItemText.trim() || totalSelected >= MAX_INCLUSIONS}
              >
                Add Item
              </Button>
            </div>

            {totalSelected >= MAX_INCLUSIONS && (
              <p className="text-xs text-red-600">
                Maximum {MAX_INCLUSIONS} items reached. Deselect an item to add more.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
```

---

## Daily Schedule Enhancement

**File:** `world-schools/apps/wc-provider/src/app/camps/[id]/edit/daily-schedule/page.tsx`

**Reference:** `WC-Booking/Camp Dashboard/Editor/4-daily-schedule-editor_8.html`

### Current State vs Target State

**Current:**
```tsx
<Textarea
  label="Daily Schedule"
  placeholder="Describe the typical daily schedule..."
  value={dailySchedule}
  onValueChange={handleChange}
/>
```

**Target:**
- **Tab System:** Daily vs Weekly schedules
- **Age Group Tabs:** Different schedules per age group (if camp has multiple age groups)
- **Timeline Builder:** Time slots with drag-and-drop reordering
- **Features:** Add/delete time slots, auto-resize textareas, time input

### Implementation Steps

**Step 1: Create Types**

```tsx
// types/daily-schedule.ts
export interface TimeSlot {
  id: string
  time: string // e.g., "8:00 AM"
  activity: string
  description?: string
}

export interface Schedule {
  id: string
  type: 'daily' | 'weekly'
  ageGroup?: string // Optional - for age-specific schedules
  day?: string // For weekly schedules: 'monday', 'tuesday', etc.
  timeSlots: TimeSlot[]
}

export interface DailyScheduleData {
  scheduleType: 'daily' | 'weekly'
  schedules: Schedule[]
}
```

**Step 2: Create Timeline Components**

```tsx
// components/camp-editor/TimelineBuilder.tsx
import { useState } from 'react'
import { Button, Input, Textarea } from '@heroui/react'

interface TimelineBuilderProps {
  schedule: Schedule
  onChange: (schedule: Schedule) => void
}

export function TimelineBuilder({ schedule, onChange }: TimelineBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}`,
      time: '',
      activity: '',
      description: '',
    }

    onChange({
      ...schedule,
      timeSlots: [...schedule.timeSlots, newSlot],
    })
  }

  const updateTimeSlot = (index: number, updates: Partial<TimeSlot>) => {
    const updated = schedule.timeSlots.map((slot, i) =>
      i === index ? { ...slot, ...updates } : slot
    )

    onChange({
      ...schedule,
      timeSlots: updated,
    })
  }

  const deleteTimeSlot = (index: number) => {
    onChange({
      ...schedule,
      timeSlots: schedule.timeSlots.filter((_, i) => i !== index),
    })
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === index) return

    const items = [...schedule.timeSlots]
    const draggedItem = items[draggedIndex]
    items.splice(draggedIndex, 1)
    items.splice(index, 0, draggedItem)

    onChange({
      ...schedule,
      timeSlots: items,
    })

    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-4">
      {/* Time Slots */}
      <div className="space-y-3">
        {schedule.timeSlots.map((slot, index) => (
          <div
            key={slot.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              flex gap-3 rounded-lg border-2 border-gray-200 bg-white p-3 transition-all
              ${draggedIndex === index ? 'opacity-50' : ''}
            `}
          >
            {/* Drag Handle */}
            <div className="flex cursor-grab items-start pt-2 text-gray-400 active:cursor-grabbing">
              ⋮⋮
            </div>

            {/* Timeline Dot */}
            <div className="relative flex flex-col items-center">
              <div className="h-3 w-3 rounded-full border-2 border-primary bg-white" />
              {index < schedule.timeSlots.length - 1 && (
                <div className="h-full w-0.5 bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={slot.time}
                  onChange={(e) => updateTimeSlot(index, { time: e.target.value })}
                  className="w-32"
                  size="sm"
                />
                <Input
                  value={slot.activity}
                  onChange={(e) => updateTimeSlot(index, { activity: e.target.value })}
                  placeholder="Activity name (e.g., Breakfast, Morning Activities)"
                  className="flex-1"
                  size="sm"
                />
              </div>

              <Textarea
                value={slot.description || ''}
                onChange={(e) => updateTimeSlot(index, { description: e.target.value })}
                placeholder="Optional description..."
                minRows={1}
                className="text-sm"
              />
            </div>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => deleteTimeSlot(index)}
              className="text-gray-400 hover:text-red-600"
              title="Delete time slot"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {/* Add Time Slot Button */}
      <Button
        onClick={addTimeSlot}
        variant="bordered"
        className="w-full"
      >
        + Add Time Slot
      </Button>
    </div>
  )
}
```

**Step 3: Update Daily Schedule Page**

```tsx
// app/camps/[id]/edit/daily-schedule/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import { useCampsStore } from '../../../../../stores/camps-store'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { TimelineBuilder } from '../../../../../components/camp-editor/TimelineBuilder'
import type { DailyScheduleData, Schedule } from '../../../../../types/daily-schedule'

export default function DailyScheduleEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const { currentCamp, updateSection, setHasUnsavedChanges } = useCampsStore()

  const [data, setData] = useState<DailyScheduleData>({
    scheduleType: 'daily',
    schedules: [],
  })

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load existing data
  useEffect(() => {
    if (currentCamp?.dailySchedule) {
      setData(currentCamp.dailySchedule)

      // Set initial selected schedule
      if (currentCamp.dailySchedule.schedules.length > 0) {
        setSelectedScheduleId(currentCamp.dailySchedule.schedules[0].id)
      }
    } else {
      // Initialize with default daily schedule
      const defaultSchedule: Schedule = {
        id: 'default-daily',
        type: 'daily',
        timeSlots: [
          { id: 'slot-1', time: '08:00', activity: 'Breakfast', description: '' },
          { id: 'slot-2', time: '09:00', activity: 'Morning Activities', description: '' },
          { id: 'slot-3', time: '12:00', activity: 'Lunch', description: '' },
          { id: 'slot-4', time: '13:00', activity: 'Afternoon Activities', description: '' },
          { id: 'slot-5', time: '18:00', activity: 'Dinner', description: '' },
          { id: 'slot-6', time: '20:00', activity: 'Evening Program', description: '' },
        ],
      }

      setData({
        scheduleType: 'daily',
        schedules: [defaultSchedule],
      })
      setSelectedScheduleId(defaultSchedule.id)
    }
  }, [currentCamp])

  // Get age groups from camp
  const ageGroups = currentCamp?.audience?.ageGroups || []
  const hasMultipleAgeGroups = ageGroups.length > 1

  // Auto-save handler
  const triggerAutoSave = (updatedData: DailyScheduleData) => {
    setHasUnsavedChanges(true)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    setAutoSaveStatus('saving')

    const timeout = setTimeout(async () => {
      try {
        await updateSection(campId, 'daily-schedule', { dailySchedule: updatedData })
        setAutoSaveStatus('saved')
        setHasUnsavedChanges(false)

        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (error) {
        console.error('Failed to save:', error)
        setAutoSaveStatus('error')
      }
    }, 1500)

    setSaveTimeout(timeout)
  }

  const handleScheduleTypeChange = (type: 'daily' | 'weekly') => {
    const updated = { ...data, scheduleType: type }
    setData(updated)
    triggerAutoSave(updated)
  }

  const updateSchedule = (scheduleId: string, updatedSchedule: Schedule) => {
    const updated = {
      ...data,
      schedules: data.schedules.map(s => s.id === scheduleId ? updatedSchedule : s),
    }
    setData(updated)
    triggerAutoSave(updated)
  }

  const addAgeGroupSchedule = (ageGroup: string) => {
    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      type: 'daily',
      ageGroup,
      timeSlots: [],
    }

    const updated = {
      ...data,
      schedules: [...data.schedules, newSchedule],
    }

    setData(updated)
    setSelectedScheduleId(newSchedule.id)
    triggerAutoSave(updated)
  }

  const currentSchedule = data.schedules.find(s => s.id === selectedScheduleId)

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Daily Schedule</h1>
          <p className="text-sm text-gray-600">
            Create a typical daily schedule for your camp
          </p>
        </div>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      <div className="space-y-6">
        {/* Schedule Type Tabs */}
        <Card>
          <CardBody>
            <Tabs
              selectedKey={data.scheduleType}
              onSelectionChange={(key) => handleScheduleTypeChange(key as 'daily' | 'weekly')}
            >
              <Tab key="daily" title="Daily Schedule">
                <div className="pt-4">
                  <p className="text-sm text-gray-600">
                    Create a typical day schedule that applies to all days
                  </p>
                </div>
              </Tab>
              <Tab key="weekly" title="Weekly Schedule">
                <div className="pt-4">
                  <p className="text-sm text-gray-600">
                    Create different schedules for each day of the week
                  </p>
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>

        {/* Age Group Tabs (if multiple age groups) */}
        {hasMultipleAgeGroups && (
          <Card>
            <CardBody>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Schedule by Age Group</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Create different schedules for different age groups
                </p>
              </div>

              <Tabs
                selectedKey={selectedScheduleId}
                onSelectionChange={(key) => setSelectedScheduleId(key as string)}
              >
                {data.schedules.map((schedule) => (
                  <Tab
                    key={schedule.id}
                    title={schedule.ageGroup || 'All Ages'}
                  />
                ))}
              </Tabs>

              {/* Add Age Group Schedule */}
              <div className="mt-4">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addAgeGroupSchedule(e.target.value)
                      e.target.value = ''
                    }
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">+ Add schedule for age group...</option>
                  {ageGroups
                    .filter(ag => !data.schedules.some(s => s.ageGroup === ag.label))
                    .map((ag) => (
                      <option key={ag.id} value={ag.label}>
                        {ag.label}
                      </option>
                    ))}
                </select>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Timeline Builder */}
        {currentSchedule && (
          <Card>
            <CardBody>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">
                  {currentSchedule.ageGroup
                    ? `Schedule for ${currentSchedule.ageGroup}`
                    : 'Daily Schedule'
                  }
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add time slots and drag to reorder
                </p>
              </div>

              <TimelineBuilder
                schedule={currentSchedule}
                onChange={(updated) => updateSchedule(currentSchedule.id, updated)}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
```

---

## Add-ons Editor Implementation

**File:** `world-schools/apps/wc-provider/src/app/camps/[id]/edit/addons/page.tsx` (NEW)

**Reference:** `WC-Booking/Camp Dashboard/Editor/20-addons-extras-editor_3.html`

**Backend:** Already fully implemented in `world-schools/apps/wc-nest-api/src/modules/provider/add-ons/`

### Implementation Steps

**Step 1: Create Types (Frontend)**

```tsx
// types/add-ons.ts
export interface AddOn {
  id: string
  name: string
  description?: string
  icon?: string
  type: 'activity' | 'service' | 'equipment' | 'language'
  price: number
  currency: string
  pricingUnit: 'per_child' | 'per_hour' | 'per_session' | 'per_week' | 'per_bag' | 'one_time'
  maxQuantity?: number
  quantityUnit?: string
  minAge?: number
  maxAge?: number
  sortOrder?: number
}

export interface CreateAddOnData {
  name: string
  description?: string
  icon?: string
  type: 'activity' | 'service' | 'equipment' | 'language'
  price: number
  currency?: string
  pricingUnit: 'per_child' | 'per_hour' | 'per_session' | 'per_week' | 'per_bag' | 'one_time'
  maxQuantity?: number
  quantityUnit?: string
  minAge?: number
  maxAge?: number
}
```

**Step 2: Create API Service**

```tsx
// services/add-ons.service.ts
import { apiClient } from '../utils/api-client'
import type { AddOn, CreateAddOnData } from '../types/add-ons'

export const addOnsService = {
  async getAll(campId: string): Promise<AddOn[]> {
    const response = await apiClient.get(`/provider/add-ons?campId=${campId}`)
    return response.data.addOns
  },

  async getOne(id: string): Promise<AddOn> {
    const response = await apiClient.get(`/provider/add-ons/${id}`)
    return response.data.addOn
  },

  async create(data: CreateAddOnData): Promise<AddOn> {
    const response = await apiClient.post('/provider/add-ons', data)
    return response.data.addOn
  },

  async update(id: string, data: Partial<CreateAddOnData>): Promise<AddOn> {
    const response = await apiClient.patch(`/provider/add-ons/${id}`, data)
    return response.data.addOn
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/provider/add-ons/${id}`)
  },
}
```

**Step 3: Create Add-ons Page Component**

```tsx
// app/camps/[id]/edit/addons/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Card,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  useDisclosure,
} from '@heroui/react'
import { addOnsService } from '../../../../../services/add-ons.service'
import type { AddOn, CreateAddOnData } from '../../../../../types/add-ons'

const ADD_ON_TYPES = [
  { value: 'activity', label: 'Activity', icon: '🎯' },
  { value: 'service', label: 'Service', icon: '🛎️' },
  { value: 'equipment', label: 'Equipment', icon: '🎒' },
  { value: 'language', label: 'Language', icon: '🗣️' },
]

const PRICING_UNITS = [
  { value: 'per_child', label: 'Per Child' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_session', label: 'Per Session' },
  { value: 'per_week', label: 'Per Week' },
  { value: 'per_bag', label: 'Per Bag' },
  { value: 'one_time', label: 'One Time' },
]

export default function AddOnsEditorPage() {
  const params = useParams()
  const campId = params.id as string

  const [addOns, setAddOns] = useState<AddOn[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingAddOn, setEditingAddOn] = useState<AddOn | null>(null)
  const [formData, setFormData] = useState<CreateAddOnData>({
    name: '',
    description: '',
    icon: '',
    type: 'activity',
    price: 0,
    currency: 'CHF',
    pricingUnit: 'per_child',
  })

  const { isOpen, onOpen, onClose } = useDisclosure()

  // Load add-ons
  useEffect(() => {
    loadAddOns()
  }, [campId])

  const loadAddOns = async () => {
    try {
      setIsLoading(true)
      const data = await addOnsService.getAll(campId)
      setAddOns(data)
    } catch (error) {
      console.error('Failed to load add-ons:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingAddOn(null)
    setFormData({
      name: '',
      description: '',
      icon: '',
      type: 'activity',
      price: 0,
      currency: 'CHF',
      pricingUnit: 'per_child',
    })
    onOpen()
  }

  const openEditModal = (addOn: AddOn) => {
    setEditingAddOn(addOn)
    setFormData({
      name: addOn.name,
      description: addOn.description,
      icon: addOn.icon,
      type: addOn.type,
      price: addOn.price,
      currency: addOn.currency,
      pricingUnit: addOn.pricingUnit,
      maxQuantity: addOn.maxQuantity,
      quantityUnit: addOn.quantityUnit,
      minAge: addOn.minAge,
      maxAge: addOn.maxAge,
    })
    onOpen()
  }

  const handleSubmit = async () => {
    try {
      if (editingAddOn) {
        await addOnsService.update(editingAddOn.id, formData)
      } else {
        await addOnsService.create(formData)
      }

      await loadAddOns()
      onClose()
    } catch (error) {
      console.error('Failed to save add-on:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return

    try {
      await addOnsService.delete(id)
      await loadAddOns()
    } catch (error) {
      console.error('Failed to delete add-on:', error)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Optional Add-ons</h1>
          <p className="text-sm text-gray-600">
            Offer optional extras that parents can add to their booking
          </p>
        </div>
        <Button color="primary" onPress={openCreateModal}>
          + Add New
        </Button>
      </div>

      {/* Add-ons List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading add-ons...</p>
        </div>
      ) : addOns.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="mb-4 text-5xl">🎁</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No add-ons yet</h3>
            <p className="mb-6 text-sm text-gray-600">
              Create optional extras like tennis lessons, airport transfers, or equipment rentals
            </p>
            <Button color="primary" onPress={openCreateModal}>
              Create Your First Add-on
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {addOns.map((addOn) => (
            <Card key={addOn.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  {/* Icon & Info */}
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{addOn.icon || '📦'}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{addOn.name}</h3>
                      {addOn.description && (
                        <p className="mt-1 text-sm text-gray-600">{addOn.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                          {ADD_ON_TYPES.find(t => t.value === addOn.type)?.label}
                        </span>
                        {addOn.minAge && addOn.maxAge && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            Ages {addOn.minAge}-{addOn.maxAge}
                          </span>
                        )}
                        {addOn.maxQuantity && (
                          <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                            Max {addOn.maxQuantity} {addOn.quantityUnit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {addOn.currency} {addOn.price}
                      </div>
                      <div className="text-xs text-gray-500">
                        {PRICING_UNITS.find(u => u.value === addOn.pricingUnit)?.label}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="bordered"
                        onPress={() => openEditModal(addOn)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="bordered"
                        onPress={() => handleDelete(addOn.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>
            {editingAddOn ? 'Edit Add-on' : 'Create Add-on'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {ADD_ON_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value as any })}
                      className={`
                        flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all
                        ${formData.type === type.value
                          ? 'border-primary bg-primary-light'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <Input
                label="Name"
                placeholder="e.g., Tennis Lessons, Airport Transfer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                isRequired
              />

              {/* Description */}
              <Textarea
                label="Description"
                placeholder="Describe what's included in this add-on..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                minRows={3}
              />

              {/* Icon */}
              <Input
                label="Icon (Emoji)"
                placeholder="🎾"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                maxLength={10}
              />

              {/* Price & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Price"
                  placeholder="0"
                  value={formData.price.toString()}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  isRequired
                  startContent={
                    <span className="text-sm text-gray-500">{formData.currency}</span>
                  }
                />

                <Select
                  label="Pricing Unit"
                  selectedKeys={[formData.pricingUnit]}
                  onChange={(e) => setFormData({ ...formData, pricingUnit: e.target.value as any })}
                >
                  {PRICING_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Age Restrictions */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Minimum Age (Optional)"
                  placeholder="6"
                  value={formData.minAge?.toString() || ''}
                  onChange={(e) => setFormData({ ...formData, minAge: parseInt(e.target.value) || undefined })}
                  min={4}
                  max={18}
                />

                <Input
                  type="number"
                  label="Maximum Age (Optional)"
                  placeholder="17"
                  value={formData.maxAge?.toString() || ''}
                  onChange={(e) => setFormData({ ...formData, maxAge: parseInt(e.target.value) || undefined })}
                  min={4}
                  max={18}
                />
              </div>

              {/* Quantity Limit */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Max Quantity (Optional)"
                  placeholder="3"
                  value={formData.maxQuantity?.toString() || ''}
                  onChange={(e) => setFormData({ ...formData, maxQuantity: parseInt(e.target.value) || undefined })}
                  min={1}
                />

                <Input
                  label="Quantity Unit (Optional)"
                  placeholder="per week"
                  value={formData.quantityUnit || ''}
                  onChange={(e) => setFormData({ ...formData, quantityUnit: e.target.value })}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isDisabled={!formData.name || formData.price <= 0}
            >
              {editingAddOn ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
```

**Step 4: Add Route to Sidebar**

Update the camp editor sidebar to include the add-ons link in the appropriate section.

---

## Backend Integration Requirements

### 1. Update DTOs for Activity Sections

For each activity section, create structured DTOs to replace generic JSON storage.

**Example: Sports Activities DTO**

```typescript
// world-schools/apps/wc-nest-api/src/modules/provider/camps/dto/update-sports.dto.ts
import { IsString, IsEnum, IsArray, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateSportsActivitiesDto {
  @ApiProperty({
    description: 'Description of the sports program',
    maxLength: 1200,
  })
  @IsString()
  @MaxLength(1200)
  description: string

  @ApiProperty({
    description: 'Skill level required',
    enum: ['all', 'beginner-intermediate', 'advanced'],
  })
  @IsEnum(['all', 'beginner-intermediate', 'advanced'])
  skillLevel: string

  @ApiProperty({
    description: 'Type of coaching offered',
    enum: ['recreational', 'competitive', 'both'],
  })
  @IsEnum(['recreational', 'competitive', 'both'])
  coachingType: string

  @ApiProperty({
    description: 'Selected predefined sports',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  selectedSports: string[]

  @ApiPropertyOptional({
    description: 'Custom sports added by provider',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customSports?: string[]

  @ApiPropertyOptional({
    description: 'Available facilities',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[]
}
```

**Create similar DTOs for:**
- `UpdateLanguagesDto`
- `UpdateArtsDto`
- `UpdateAdventureDto`
- `UpdateWaterActivitiesDto`
- `UpdateEnvironmentalDto`
- `UpdateAcademicsDto`
- `UpdateReligionDto`
- `UpdateExcursionsDto`
- `UpdateLocationCampusDto`
- `UpdateAccommodationDto`
- `UpdateGettingThereDto`
- `UpdateCampFocusDto`
- `UpdateMealsDto`

### 2. Update What's Included DTO

```typescript
// dto/update-whats-included.dto.ts
import { IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

class InclusionItemDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  text: string

  @ApiProperty()
  icon: string

  @ApiProperty({ required: false })
  source?: string

  @ApiProperty()
  isAutoGenerated: boolean

  @ApiProperty()
  isSelected: boolean
}

export class UpdateWhatsIncludedDto {
  @ApiProperty({ type: [InclusionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InclusionItemDto)
  autoGenerated: InclusionItemDto[]

  @ApiProperty({ type: [InclusionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InclusionItemDto)
  manual: InclusionItemDto[]
}
```

### 3. Update Daily Schedule DTO

```typescript
// dto/update-daily-schedule.dto.ts
import { IsString, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class TimeSlotDto {
  @ApiProperty()
  @IsString()
  id: string

  @ApiProperty()
  @IsString()
  time: string

  @ApiProperty()
  @IsString()
  activity: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string
}

class ScheduleDto {
  @ApiProperty()
  @IsString()
  id: string

  @ApiProperty({ enum: ['daily', 'weekly'] })
  @IsEnum(['daily', 'weekly'])
  type: 'daily' | 'weekly'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ageGroup?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  day?: string

  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots: TimeSlotDto[]
}

export class UpdateDailyScheduleDto {
  @ApiProperty({ enum: ['daily', 'weekly'] })
  @IsEnum(['daily', 'weekly'])
  scheduleType: 'daily' | 'weekly'

  @ApiProperty({ type: [ScheduleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules: ScheduleDto[]
}
```

### 4. Update Controller Endpoints

```typescript
// camps.controller.ts
import { UpdateSportsActivitiesDto } from './dto/update-sports.dto'
import { UpdateWhatsIncludedDto } from './dto/update-whats-included.dto'
import { UpdateDailyScheduleDto } from './dto/update-daily-schedule.dto'

// Add specific endpoints for each section
@Patch(':id/sports')
@Permissions(permissions.UPDATE_CAMP.name)
async updateSports(
  @Param('id') id: string,
  @Body() dto: UpdateSportsActivitiesDto,
  @CurrentUser() user: any
) {
  const providerId = await this.getProviderIdForUser(user)
  const camp = await this.campsService.updateSports(id, providerId, dto)
  return ResponseUtil.success({ camp })
}

@Patch(':id/whats-included')
@Permissions(permissions.UPDATE_CAMP.name)
async updateWhatsIncluded(
  @Param('id') id: string,
  @Body() dto: UpdateWhatsIncludedDto,
  @CurrentUser() user: any
) {
  const providerId = await this.getProviderIdForUser(user)
  const camp = await this.campsService.updateWhatsIncluded(id, providerId, dto)
  return ResponseUtil.success({ camp })
}

@Patch(':id/daily-schedule')
@Permissions(permissions.UPDATE_CAMP.name)
async updateDailySchedule(
  @Param('id') id: string,
  @Body() dto: UpdateDailyScheduleDto,
  @CurrentUser() user: any
) {
  const providerId = await this.getProviderIdForUser(user)
  const camp = await this.campsService.updateDailySchedule(id, providerId, dto)
  return ResponseUtil.success({ camp })
}

// Repeat for all other activity sections...
```

### 5. Update Service Methods

```typescript
// camps.service.ts

async updateSports(
  campId: string,
  providerId: string,
  dto: UpdateSportsActivitiesDto
): Promise<Camp> {
  // Verify ownership
  const camp = await this.findOne(campId, providerId)

  // Update with structured data
  return this.prisma.camp.update({
    where: { id: campId },
    data: {
      sportsActivities: dto,
    },
  })
}

async updateWhatsIncluded(
  campId: string,
  providerId: string,
  dto: UpdateWhatsIncludedDto
): Promise<Camp> {
  const camp = await this.findOne(campId, providerId)

  return this.prisma.camp.update({
    where: { id: campId },
    data: {
      whatsIncluded: dto,
    },
  })
}

async updateDailySchedule(
  campId: string,
  providerId: string,
  dto: UpdateDailyScheduleDto
): Promise<Camp> {
  const camp = await this.findOne(campId, providerId)

  return this.prisma.camp.update({
    where: { id: campId },
    data: {
      dailySchedule: dto,
    },
  })
}

// Repeat for all other sections...
```

### 6. Update Prisma Schema (if needed)

The current schema stores these as JSON fields, which is fine. However, you may want to add validation at the database level:

```prisma
// schema.prisma
model Camp {
  // ... existing fields

  sportsActivities   Json?  @map("sports_activities")
  languagePrograms   Json?  @map("language_programs")
  artsActivities     Json?  @map("arts_activities")
  adventureActivities Json? @map("adventure_activities")
  waterActivities    Json?  @map("water_activities")
  environmentalActivities Json? @map("environmental_activities")
  academicPrograms   Json?  @map("academic_programs")
  religionPrograms   Json?  @map("religion_programs")
  excursions         Json?  @map("excursions")
  locationCampus     Json?  @map("location_campus")
  whatsIncluded      Json?  @map("whats_included")
  dailySchedule      Json?  @map("daily_schedule")

  // ... rest of fields
}
```

---

## Implementation Checklist

### Phase 1: Shared Components (Week 1, Days 1-2)

- [ ] Create `ActivityGrid` component
- [ ] Create `CharacterCounter` component
- [ ] Create `AutoSaveIndicator` component
- [ ] Create `CustomActivityInput` component
- [ ] Create `TimelineBuilder` component
- [ ] Test all shared components in isolation

### Phase 2: Activity Editors - Batch 1 (Week 1, Days 3-5)

- [ ] **Sports Activities**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Languages**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Arts & Crafts**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Adventure Activities**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Water Activities**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

### Phase 3: Activity Editors - Batch 2 (Week 2, Days 1-3)

- [ ] **Environmental Activities**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Academics**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Religion Programs**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Excursions**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Location & Campus**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

### Phase 4: Activity Editors - Batch 3 (Week 2, Days 4-5)

- [ ] **Accommodation**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Getting There**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Camp Focus**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

- [ ] **Meals & Dietary**
  - [ ] Create constants file
  - [ ] Update page component
  - [ ] Create backend DTO
  - [ ] Update controller endpoint
  - [ ] Update service method
  - [ ] Test end-to-end

### Phase 5: What's Included (Week 3, Days 1-2)

- [ ] Create types
- [ ] Create auto-generation utility
- [ ] Update page component
- [ ] Create backend DTO
- [ ] Update controller endpoint
- [ ] Update service method
- [ ] Test auto-generation logic
- [ ] Test manual additions
- [ ] Test selection limits
- [ ] Test end-to-end

### Phase 6: Daily Schedule (Week 3, Days 3-4)

- [ ] Create types
- [ ] Create `TimelineBuilder` component (if not done in Phase 1)
- [ ] Update page component
- [ ] Create backend DTO
- [ ] Update controller endpoint
- [ ] Update service method
- [ ] Test daily schedule
- [ ] Test weekly schedule
- [ ] Test age group schedules
- [ ] Test drag-and-drop
- [ ] Test end-to-end

### Phase 7: Add-ons Editor (Week 3, Day 5)

- [ ] Create frontend types
- [ ] Create API service
- [ ] Create page component
- [ ] Add route to sidebar
- [ ] Test CRUD operations
- [ ] Test validation
- [ ] Test end-to-end

### Phase 8: Testing & Polish (Week 4)

- [ ] **Integration Testing**
  - [ ] Test all auto-save functionality
  - [ ] Test character counters
  - [ ] Test validation across all sections
  - [ ] Test navigation between sections
  - [ ] Test data persistence

- [ ] **UI/UX Polish**
  - [ ] Ensure consistent styling
  - [ ] Test responsive design on mobile
  - [ ] Test accessibility (keyboard navigation, screen readers)
  - [ ] Add loading states
  - [ ] Add error states
  - [ ] Add success notifications

- [ ] **Performance**
  - [ ] Optimize auto-save debouncing
  - [ ] Test with large datasets
  - [ ] Optimize re-renders
  - [ ] Add proper memoization

- [ ] **Documentation**
  - [ ] Update API documentation
  - [ ] Create user guide for camp editors
  - [ ] Document component props
  - [ ] Add inline code comments

---

## Quick Reference: File Paths

### Frontend Files to Create/Modify

**Components:**
```
world-schools/apps/wc-provider/src/components/camp-editor/
├── ActivityGrid.tsx (NEW)
├── CharacterCounter.tsx (NEW)
├── AutoSaveIndicator.tsx (NEW)
├── CustomActivityInput.tsx (NEW)
└── TimelineBuilder.tsx (NEW)
```

**Constants:**
```
world-schools/apps/wc-provider/src/constants/
├── sports-activities.ts (NEW)
├── languages-activities.ts (NEW)
├── arts-activities.ts (NEW)
├── adventure-activities.ts (NEW)
├── water-activities.ts (NEW)
├── environmental-activities.ts (NEW)
├── academics-activities.ts (NEW)
├── religion-activities.ts (NEW)
├── excursions-activities.ts (NEW)
├── location-campus-activities.ts (NEW)
├── accommodation-activities.ts (NEW)
├── getting-there-activities.ts (NEW)
├── camp-focus-activities.ts (NEW)
└── meals-activities.ts (NEW)
```

**Types:**
```
world-schools/apps/wc-provider/src/types/
├── whats-included.ts (NEW)
├── daily-schedule.ts (NEW)
└── add-ons.ts (NEW)
```

**Services:**
```
world-schools/apps/wc-provider/src/services/
└── add-ons.service.ts (NEW)
```

**Utils:**
```
world-schools/apps/wc-provider/src/utils/
└── generate-inclusions.ts (NEW)
```

**Pages to Modify:**
```
world-schools/apps/wc-provider/src/app/camps/[id]/edit/
├── sports/page.tsx (MODIFY)
├── languages/page.tsx (MODIFY)
├── arts/page.tsx (MODIFY)
├── adventure/page.tsx (MODIFY)
├── water/page.tsx (MODIFY)
├── environmental/page.tsx (MODIFY)
├── academics/page.tsx (MODIFY)
├── religion/page.tsx (MODIFY)
├── excursions/page.tsx (MODIFY)
├── location-campus/page.tsx (MODIFY)
├── accommodation/page.tsx (MODIFY)
├── getting-there/page.tsx (MODIFY)
├── camp-focus/page.tsx (MODIFY)
├── meals/page.tsx (MODIFY)
├── whats-included/page.tsx (MODIFY)
├── daily-schedule/page.tsx (MODIFY)
└── addons/page.tsx (NEW)
```

### Backend Files to Create/Modify

**DTOs:**
```
world-schools/apps/wc-nest-api/src/modules/provider/camps/dto/
├── update-sports.dto.ts (NEW)
├── update-languages.dto.ts (NEW)
├── update-arts.dto.ts (NEW)
├── update-adventure.dto.ts (NEW)
├── update-water-activities.dto.ts (NEW)
├── update-environmental.dto.ts (NEW)
├── update-academics.dto.ts (NEW)
├── update-religion.dto.ts (NEW)
├── update-excursions.dto.ts (NEW)
├── update-location-campus.dto.ts (NEW)
├── update-accommodation.dto.ts (NEW)
├── update-getting-there.dto.ts (NEW)
├── update-camp-focus.dto.ts (NEW)
├── update-meals.dto.ts (NEW)
├── update-whats-included.dto.ts (NEW)
└── update-daily-schedule.dto.ts (NEW)
```

**Controller & Service:**
```
world-schools/apps/wc-nest-api/src/modules/provider/camps/
├── camps.controller.ts (MODIFY - add new endpoints)
└── camps.service.ts (MODIFY - add new methods)
```

---

## Estimated Timeline

**Total Effort:** 3-4 weeks (1 developer, full-time)

- **Week 1:** Shared components + Activity Editors Batch 1 (5 sections)
- **Week 2:** Activity Editors Batch 2 & 3 (10 sections)
- **Week 3:** What's Included, Daily Schedule, Add-ons
- **Week 4:** Testing, polish, documentation

**Parallel Work Opportunities:**
- Frontend and backend can be developed in parallel
- Different activity sections can be assigned to different developers
- Shared components should be completed first

---

## Success Criteria

✅ **Functionality:**
- All 15 activity editors upgraded with grid-based UI
- What's Included auto-generation working
- Daily Schedule timeline builder functional
- Add-ons CRUD operations working
- Auto-save working across all sections
- Character counters accurate
- Validation preventing invalid data

✅ **Code Quality:**
- Type-safe frontend-backend contract
- Proper error handling
- Consistent component structure
- Reusable components
- Clean, maintainable code

✅ **User Experience:**
- Intuitive UI matching reference designs
- Responsive on all devices
- Fast and smooth interactions
- Clear feedback on actions
- Accessible to all users

✅ **Testing:**
- All sections tested end-to-end
- Edge cases handled
- Performance optimized
- No regressions in existing functionality

---

**END OF IMPLEMENTATION GUIDE**


