# Sessions Management - Developer Quick Reference

**Last Updated:** 2026-01-16  
**For:** Frontend Developers implementing Sessions UI

---

## 🚀 Quick Start

### What's Already Built
```
✅ Backend API (NestJS)
✅ Database Schema (Prisma)
✅ TypeScript Types
✅ API Service Layer
```

### What You Need to Build
```
❌ UI Components (100%)
❌ Custom Hooks
❌ Pages
❌ Integration
```

---

## 📁 File Structure to Create

```
apps/wc-provider/src/
├── app/
│   ├── camps/
│   │   ├── [id]/
│   │   │   └── edit/
│   │   │       └── sessions/
│   │   │           └── page.tsx                    ← CREATE THIS
│   │   └── create/
│   │       └── sessions/
│   │           └── page.tsx                        ← CREATE THIS
│
├── components/
│   └── sessions/                                   ← CREATE THIS FOLDER
│       ├── SessionTypeSelector.tsx
│       ├── FlexibleSessions/
│       │   ├── FlexibleSessionsList.tsx
│       │   ├── FlexibleSessionCard.tsx
│       │   ├── AddFlexibleSessionModal.tsx
│       │   ├── FlexibleSessionForm.tsx
│       │   └── FlexibleSessionEmpty.tsx
│       ├── FixedSessions/
│       │   ├── FixedSessionsList.tsx
│       │   ├── FixedSessionRow.tsx
│       │   ├── AddFixedSessionModal.tsx
│       │   ├── FixedSessionForm.tsx
│       │   └── FixedSessionEmpty.tsx
│       └── shared/
│           ├── SessionStatusBadge.tsx
│           ├── SessionCapacityIndicator.tsx
│           ├── SessionPricingDisplay.tsx
│           └── DeleteSessionDialog.tsx
│
├── hooks/                                          ← CREATE THESE
│   ├── useSessionsData.tsx
│   ├── useSessionMutations.tsx
│   └── useSessionValidation.tsx
│
└── utils/                                          ← CREATE THESE
    ├── sessionValidators.ts
    ├── sessionCalculations.ts
    └── sessionFormatters.ts
```

---

## 🔌 API Endpoints (Already Built)

### Base URL
```
/provider/camps/:campId/sessions
```

### Available Endpoints

| Method | Endpoint | Purpose | Service Method |
|--------|----------|---------|----------------|
| GET | `/type` | Get session type | `getSessionType(campId)` |
| PUT | `/type` | Set session type | `setSessionType(campId, dto)` |
| GET | `/flexible` | Get flexible sessions | `getFlexibleSessions(campId)` |
| POST | `/flexible` | Create flexible session | `createFlexibleSession(campId, dto)` |
| PUT | `/flexible/:id` | Update flexible session | `updateFlexibleSession(campId, id, dto)` |
| GET | `/fixed` | Get fixed sessions | `getFixedSessions(campId)` |
| POST | `/fixed` | Create fixed session | `createFixedSession(campId, id, dto)` |
| PUT | `/fixed/:id` | Update fixed session | `updateFixedSession(campId, id, dto)` |
| DELETE | `/:sessionId` | Delete session | `deleteSession(campId, sessionId)` |
| PATCH | `/:sessionId/toggle` | Toggle active status | `toggleSessionStatus(campId, sessionId)` |
| POST | `/fixed/:id/duplicate` | Duplicate fixed session | `duplicateFixedSession(campId, id)` |

---

## 📦 Import Paths

### Services
```typescript
import {
  getSessionType,
  setSessionType,
  getFlexibleSessions,
  createFlexibleSession,
  updateFlexibleSession,
  getFixedSessions,
  createFixedSession,
  updateFixedSession,
  deleteSession,
  toggleSessionStatus,
  duplicateFixedSession,
} from '@/services/sessions.service'
```

### Types
```typescript
import type {
  SessionType,
  Session,
  FlexibleSession,
  FixedSession,
  Duration,
  BlackoutDate,
  CreateFlexibleSessionDto,
  CreateFixedSessionDto,
  UpdateFlexibleSessionDto,
  UpdateFixedSessionDto,
  UpdateSessionTypeDto,
  SessionTypeResponse,
  FlexibleSessionsResponse,
  FixedSessionsResponse,
  SessionResponse,
  DeleteSessionResponse,
} from '@/types/sessions'
```

### HeroUI Components
```typescript
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  Chip,
  Spinner,
} from '@heroui/react'
```

---

## 🎨 Design References

### Figma/Design Files Location
```
/sessions/
├── flex-session-1.png          # Type selector
├── flex-session-2.png          # Empty state
├── flex-session-3.1.png        # Add modal step 1
├── flex-session-3.2.png        # Add modal step 2
├── flex-session-4.1.png        # Sessions list
├── flex-session-4.2.png        # Edit modal
├── flex-session-4.3.png        # Delete confirmation
├── flex-session-4.4.png        # Multiple sessions
├── fixed-session-1.1.png       # Empty state
└── fixed-session-1.2.png       # Sessions list
```

---

## 🧩 Component Patterns

### Pattern 1: Using Session Data Hook
```typescript
'use client'

import { useSessionsData } from '@/hooks/useSessionsData'

export function SessionsPage({ campId }: { campId: string }) {
  const { sessionType, sessions, isLoading, error, reload } = useSessionsData(campId)

  if (isLoading) return <Spinner />
  if (error) return <div>Error: {error}</div>
  if (!sessionType) return <SessionTypeSelector campId={campId} />

  return sessionType === 'flexible' 
    ? <FlexibleSessionsList sessions={sessions} campId={campId} />
    : <FixedSessionsList sessions={sessions} campId={campId} />
}
```

### Pattern 2: Using Mutations Hook
```typescript
'use client'

import { useSessionMutations } from '@/hooks/useSessionMutations'

export function AddSessionButton({ campId }: { campId: string }) {
  const { createFlexibleSession, isCreating } = useSessionMutations(campId)

  const handleCreate = async (data: CreateFlexibleSessionDto) => {
    await createFlexibleSession(data, {
      onSuccess: () => {
        toast.success('Session created!')
        onClose()
      },
      onError: (error) => {
        toast.error(error.message)
      }
    })
  }

  return <Button onPress={handleCreate} isLoading={isCreating}>Add Session</Button>
}
```

### Pattern 3: Modal with Form
```typescript
'use client'

import { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

export function AddSessionModal({ isOpen, onClose, campId }: Props) {
  const [formData, setFormData] = useState<CreateFlexibleSessionDto>({
    name: '',
    startDate: '',
    endDate: '',
    durations: [],
  })

  const { createFlexibleSession, isCreating } = useSessionMutations(campId)

  const handleSubmit = async () => {
    await createFlexibleSession(formData, {
      onSuccess: () => {
        toast.success('Session created!')
        onClose()
      }
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Add Flexible Session</ModalHeader>
        <ModalBody>
          {/* Form fields */}
        </ModalBody>
        <ModalFooter>
          <Button onPress={onClose}>Cancel</Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isCreating}>
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
```

---

## 🎯 Key Business Rules

### Session Type
- ✅ Each camp has ONE session type (flexible OR fixed)
- ✅ Cannot change type after first session is created
- ✅ Cannot change type if bookings exist

### Flexible Sessions
- ✅ Must have at least 1 duration option
- ✅ Durations must be in weeks (1-12 weeks)
- ✅ Each duration has its own price
- ✅ Start date must be before end date
- ✅ Blackout dates must be within session range

### Fixed Sessions
- ✅ Start date must be before end date
- ✅ Must have a price
- ✅ Capacity is optional (unlimited if not set)
- ✅ Cannot delete if bookings exist

### Publishing
- ✅ Camp cannot be published without at least 1 active session
- ✅ Must have session type selected

---

## 🔍 Testing Checklist

### Manual Testing
- [ ] Can select session type
- [ ] Can create flexible session
- [ ] Can create fixed session
- [ ] Can edit session
- [ ] Can delete session (no bookings)
- [ ] Cannot delete session (with bookings)
- [ ] Can toggle session status
- [ ] Can duplicate fixed session
- [ ] Validation works
- [ ] Error handling works
- [ ] Loading states work
- [ ] Empty states show correctly

### Edge Cases
- [ ] No sessions yet
- [ ] Session with bookings
- [ ] Invalid date ranges
- [ ] Invalid pricing
- [ ] Network errors
- [ ] Concurrent edits

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot read property 'type' of null"
**Solution:** Check if sessionType is loaded before rendering

### Issue: "Session not updating"
**Solution:** Make sure to call reload() after mutations

### Issue: "Validation errors not showing"
**Solution:** Check useSessionValidation hook implementation

### Issue: "Modal not closing after submit"
**Solution:** Call onClose() in onSuccess callback

---

## 📚 Additional Resources

### Documentation
- [Implementation Plan](./SESSIONS_MANAGEMENT_IMPLEMENTATION_PLAN.md)
- [Gap Analysis](./SESSIONS_IMPLEMENTATION_GAP_ANALYSIS.md)
- [Next Steps Roadmap](./SESSIONS_NEXT_STEPS_ROADMAP.md)

### Code Examples
- Similar feature: Add-ons management (`components/add-ons/`)
- Wizard pattern: Camp creation wizard (`app/camps/create/`)
- Editor pattern: Camp editor (`app/camps/[id]/edit/`)

### External Docs
- [HeroUI Components](https://heroui.com)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Hook Form](https://react-hook-form.com) (if using)

---

## 🆘 Need Help?

### Questions to Ask
1. What's the expected behavior?
2. What does the design show?
3. Is there a similar component I can reference?
4. What's the API contract?

### Where to Look
1. Check design files in `/sessions/`
2. Check implementation plan Section 3 (UI Components)
3. Check existing add-ons components for patterns
4. Check API service layer for available methods

---

**Happy Coding! 🚀**

