# Sessions Management - Next Steps Roadmap

**Date:** 2026-01-16  
**Current Status:** Backend Complete, Frontend Services Complete, UI 0%  
**Target:** Complete MVP in 4-5 weeks

---

## Quick Start Guide

### What's Already Done ✅
- Backend API (11 endpoints)
- Database schema
- TypeScript types
- API service layer
- All DTOs and validation

### What You Need to Build ❌
- All UI components
- Custom hooks
- Page integrations
- Wizard/Editor integration

---

## Week 2: Frontend Foundation (5-7 days)

### Day 1-2: Custom Hooks

#### 1. Create `hooks/useSessionsData.tsx`
```typescript
// Location: apps/wc-provider/src/hooks/useSessionsData.tsx
// Purpose: Data fetching and caching for sessions
// Dependencies: @/services/sessions.service, @/types/sessions
// Key features:
// - Load session type
// - Load sessions based on type
// - Handle loading/error states
// - Provide reload function
```

**Implementation checklist:**
- [ ] Create file structure
- [ ] Import required dependencies
- [ ] Implement useEffect for data loading
- [ ] Add error handling
- [ ] Add loading states
- [ ] Export hook

#### 2. Create `hooks/useSessionMutations.tsx`
```typescript
// Location: apps/wc-provider/src/hooks/useSessionMutations.tsx
// Purpose: CRUD operations for sessions
// Dependencies: @/services/sessions.service
// Key features:
// - setSessionType
// - createFlexibleSession
// - updateFlexibleSession
// - createFixedSession
// - updateFixedSession
// - deleteSession
// - toggleSessionStatus
// - duplicateFixedSession
```

**Implementation checklist:**
- [ ] Create mutation functions
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success callbacks
- [ ] Add toast notifications

#### 3. Create `hooks/useSessionValidation.tsx`
```typescript
// Location: apps/wc-provider/src/hooks/useSessionValidation.tsx
// Purpose: Form validation logic
// Key features:
// - Validate session name
// - Validate dates
// - Validate durations
// - Validate pricing
// - Validate capacity
```

**Implementation checklist:**
- [ ] Create validation functions
- [ ] Add error messages
- [ ] Export validation hook

### Day 3: Utility Functions

#### 4. Create `utils/sessionValidators.ts`
```typescript
// Validation functions for sessions
// - validateDateRange
// - validateDurations
// - validatePricing
// - validateCapacity
// - validateBlackoutDates
```

#### 5. Create `utils/sessionCalculations.ts`
```typescript
// Calculation utilities
// - calculateDuration (days between dates)
// - calculateTotalPrice
// - calculateAvailableSpots
// - formatDuration (e.g., "2 weeks")
```

#### 6. Create `utils/sessionFormatters.ts`
```typescript
// Formatting utilities
// - formatDate
// - formatCurrency
// - formatCapacity
// - formatDateRange
```

---

## Week 3: Core UI Components (7-10 days)

### Day 1-2: Session Type Selector

#### 7. Create `components/sessions/SessionTypeSelector.tsx`
**Reference:** Plan Section 6.5, Design: flex-session-1.png

**Features:**
- Two selection cards (Flexible vs Fixed)
- Visual selection state
- Continue button
- Warning notice about permanence

**Implementation checklist:**
- [ ] Create component file
- [ ] Import HeroUI components (Card, Button)
- [ ] Add selection state
- [ ] Implement card press handlers
- [ ] Add continue button logic
- [ ] Add warning notice
- [ ] Style with Tailwind

### Day 3-5: Flexible Sessions Components

#### 8. Create `components/sessions/FlexibleSessions/FlexibleSessionsList.tsx`
**Reference:** Plan Section 3.1, Design: flex-session-4.1, 4.4

**Features:**
- Display list of flexible sessions
- Empty state
- Add session button
- Session cards grid

**Implementation checklist:**
- [ ] Create component
- [ ] Add empty state check
- [ ] Map sessions to cards
- [ ] Add "Add Session" button
- [ ] Handle modal open/close

#### 9. Create `components/sessions/FlexibleSessions/FlexibleSessionCard.tsx`
**Reference:** Design: flex-session-4.1

**Features:**
- Session name
- Date range badge
- Duration chips with prices
- Capacity indicator
- Status badge
- Action buttons (Edit, Delete, Toggle)

**Implementation checklist:**
- [ ] Create card layout
- [ ] Display session info
- [ ] Add action buttons
- [ ] Add status badge
- [ ] Add hover effects

#### 10. Create `components/sessions/FlexibleSessions/AddFlexibleSessionModal.tsx`
**Reference:** Plan Section 3.1, Design: flex-session-3.1, 3.2

**Features:**
- Multi-step modal (2 steps)
- Step 1: Name, dates, durations
- Step 2: Pricing, capacity
- Navigation between steps

**Implementation checklist:**
- [ ] Create modal component
- [ ] Add step state management
- [ ] Implement Step 1 form
- [ ] Implement Step 2 form
- [ ] Add navigation buttons
- [ ] Add form submission

#### 11. Create `components/sessions/FlexibleSessions/FlexibleSessionForm.tsx`
**Reference:** Plan Section 3.1

**Features:**
- Form fields for all session data
- Validation
- Duration selector
- Blackout dates management

**Implementation checklist:**
- [ ] Create form component
- [ ] Add all input fields
- [ ] Add validation
- [ ] Add duration chips
- [ ] Add blackout dates UI

#### 12. Create `components/sessions/FlexibleSessions/FlexibleSessionEmpty.tsx`
**Reference:** Design: flex-session-2.png

**Features:**
- Empty state illustration
- Message
- Add button

**Implementation checklist:**
- [ ] Create empty state component
- [ ] Add illustration/icon
- [ ] Add message text
- [ ] Add CTA button

### Day 6-7: Fixed Sessions Components

#### 13. Create `components/sessions/FixedSessions/FixedSessionsList.tsx`
**Reference:** Design: fixed-session-1.2

**Features:**
- Table/card layout
- Session rows
- Empty state
- Add session button

**Implementation checklist:**
- [ ] Create list component
- [ ] Add table/card layout
- [ ] Map sessions to rows
- [ ] Add empty state
- [ ] Add "Add Session" button

#### 14. Create `components/sessions/FixedSessions/FixedSessionRow.tsx`
**Reference:** Design: fixed-session-1.2

**Features:**
- Session name
- Start/end dates
- Duration (auto-calculated)
- Price
- Capacity
- Status
- Actions (Edit, Duplicate, Delete)

**Implementation checklist:**
- [ ] Create row component
- [ ] Display session data
- [ ] Add action buttons
- [ ] Add status indicator
- [ ] Add color coding

#### 15. Create `components/sessions/FixedSessions/AddFixedSessionModal.tsx`
**Features:**
- Single-step modal
- All fields in one form
- Simpler than flexible

**Implementation checklist:**
- [ ] Create modal component
- [ ] Add form fields
- [ ] Add validation
- [ ] Add submission logic

#### 16. Create `components/sessions/FixedSessions/FixedSessionForm.tsx`
**Features:**
- Form fields for fixed session
- Date pickers
- Price input
- Capacity input

**Implementation checklist:**
- [ ] Create form component
- [ ] Add all input fields
- [ ] Add validation
- [ ] Add date pickers

#### 17. Create `components/sessions/FixedSessions/FixedSessionEmpty.tsx`
**Reference:** Design: fixed-session-1.1

**Features:**
- Empty state for fixed sessions
- Different message than flexible

**Implementation checklist:**
- [ ] Create empty state component
- [ ] Add illustration
- [ ] Add message
- [ ] Add CTA button

### Day 8: Shared Components

#### 18. Create `components/sessions/shared/SessionStatusBadge.tsx`
**Features:**
- Status indicator (Active/Inactive)
- Color coding

**Implementation checklist:**
- [ ] Create badge component
- [ ] Add status prop
- [ ] Add color variants
- [ ] Style with HeroUI Chip

#### 19. Create `components/sessions/shared/SessionCapacityIndicator.tsx`
**Features:**
- Display capacity (e.g., "50 spots" or "Unlimited")
- Show booked/total for fixed sessions

**Implementation checklist:**
- [ ] Create indicator component
- [ ] Handle unlimited capacity
- [ ] Show booked count
- [ ] Add visual indicator

#### 20. Create `components/sessions/shared/SessionPricingDisplay.tsx`
**Features:**
- Display pricing for durations
- Format currency

**Implementation checklist:**
- [ ] Create pricing component
- [ ] Format currency
- [ ] Display duration prices
- [ ] Handle multiple durations

#### 21. Create `components/sessions/shared/DeleteSessionDialog.tsx`
**Reference:** Design: flex-session-4.3

**Features:**
- Confirmation dialog
- Warning message
- Booking impact notice
- Cancel/Delete buttons

**Implementation checklist:**
- [ ] Create dialog component
- [ ] Add warning message
- [ ] Show booking count
- [ ] Add action buttons
- [ ] Handle delete confirmation

### Day 9-10: Main Pages

#### 22. Create `app/camps/[id]/edit/sessions/page.tsx`
**Reference:** Plan Section 6.4

**Features:**
- Main sessions page for editor
- Load session data
- Show type selector or sessions list
- Handle loading/error states

**Implementation checklist:**
- [ ] Create page component
- [ ] Use useSessionsData hook
- [ ] Conditional rendering
- [ ] Add loading spinner
- [ ] Add error display

#### 23. Create `app/camps/create/sessions/page.tsx`
**Reference:** Plan Section 7.1

**Features:**
- Wizard Step 5
- Reuse editor sessions page
- Set wizard step

**Implementation checklist:**
- [ ] Create wizard page
- [ ] Reuse SessionsPage component
- [ ] Set wizard step
- [ ] Handle camp ID from query params

---

## Week 4: Integration (7-10 days)

### Day 1-2: Wizard Integration

#### 24. Update Camp Wizard Sidebar
**File:** `components/camps/CampWizardSidebar.tsx`

**Changes:**
- [ ] Add Step 5 to WIZARD_STEPS array
- [ ] Update step navigation

#### 25. Update Camp Wizard Footer
**File:** `components/camps/CampWizardFooter.tsx`

**Changes:**
- [ ] Add Step 5 to STEP_PATHS
- [ ] Update handleNext logic
- [ ] Add "Publish Camp" button for Step 5
- [ ] Add "Save as Draft" button

### Day 3-4: Editor Integration

#### 26. Update Camp Editor Sidebar
**File:** `components/camp-editor/CampEditorSidebar.tsx`

**Changes:**
- [ ] Add "Sessions" to editorSections
- [ ] Add to "SESSIONS & BOOKING" category
- [ ] Update navigation

#### 27. Update Camp Editor Footer
**File:** `components/camp-editor/CampEditorFooter.tsx`

**Changes:**
- [ ] Add "sessions" to editorSections array
- [ ] Add to autoSaveOnlySections
- [ ] Update navigation order

### Day 5-6: Validation Integration

#### 28. Update Camp Publishing Validation
**File:** `utils/campValidation.ts` (or create if doesn't exist)

**Changes:**
- [ ] Add session type check
- [ ] Add active session count check
- [ ] Add to publishing requirements

### Day 7: Auto-Save Implementation

#### 29. Implement Auto-Save for Sessions
**Reference:** Plan Section 8

**Changes:**
- [ ] Add debounced save to forms
- [ ] Add auto-save status indicator
- [ ] Add "Changes saved" message
- [ ] Handle auto-save errors

---

## Week 5: Testing & Polish (5-7 days)

### Testing

#### 30. Unit Tests
- [ ] Test custom hooks
- [ ] Test utility functions
- [ ] Test validation logic

#### 31. Integration Tests
- [ ] Test API service calls
- [ ] Test component interactions
- [ ] Test form submissions

#### 32. E2E Tests
- [ ] Test wizard flow
- [ ] Test editor flow
- [ ] Test session creation
- [ ] Test session editing
- [ ] Test session deletion

### Polish

#### 33. UI/UX Improvements
- [ ] Add loading skeletons
- [ ] Add animations
- [ ] Improve error messages
- [ ] Add tooltips
- [ ] Responsive design check

#### 34. Performance Optimization
- [ ] Optimize re-renders
- [ ] Add memoization
- [ ] Lazy load components
- [ ] Optimize API calls

---

## Success Criteria

### Must Have (MVP)
- [ ] Can select session type
- [ ] Can create flexible sessions
- [ ] Can create fixed sessions
- [ ] Can edit sessions
- [ ] Can delete sessions (if no bookings)
- [ ] Can toggle session status
- [ ] Wizard Step 5 works
- [ ] Editor integration works
- [ ] Validation prevents publishing without sessions

### Nice to Have
- [ ] Duplicate fixed sessions
- [ ] Bulk operations
- [ ] Session templates
- [ ] Advanced validation

---

## Resources

### Design Files
- Location: `/sessions/` directory
- Key files: flex-session-*.png, fixed-session-*.png

### Code References
- Existing patterns: Add-ons management
- Similar components: Camp wizard, Camp editor
- HeroUI docs: https://heroui.com

### Plan Documents
- Implementation Plan: `SESSIONS_MANAGEMENT_IMPLEMENTATION_PLAN.md`
- Gap Analysis: `SESSIONS_IMPLEMENTATION_GAP_ANALYSIS.md`

---

## Daily Checklist Template

```markdown
### Day X: [Task Name]

**Goal:** [What to accomplish]

**Tasks:**
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

**Blockers:** None / [List blockers]

**Notes:** [Any important notes]

**Tomorrow:** [What's next]
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16  
**Next Review:** End of Week 3

