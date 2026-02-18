# WebSocket Connection Fix - Message Organizer Button

## Problem Summary

When clicking the "Message organizer" button in the camp details page, users encountered the following error:

```
[WebSocketService] Cannot join conversation: not connected
```

### Root Cause

A **race condition** existed between:
1. Navigation to `/messages/{conversationId}` (immediate)
2. WebSocket connection establishment (asynchronous)

**Flow that caused the issue:**
1. User clicks "Message organizer" button
2. `handleMessageOrganizer` creates conversation and calls `setActiveConversation(conversationId)`
3. `setActiveConversation` attempts to call `wsService.joinConversation(conversationId)`
4. **BUT** - WebSocket is not connected yet (it only connects when messages page mounts)
5. `joinConversation` fails with "not connected" error
6. User navigates to messages page
7. Messages page initializes WebSocket connection (too late!)

## Solution Implemented

### 1. **Early WebSocket Initialization** ✅

Created a `MessagingProvider` component that initializes the WebSocket connection when the user is authenticated, not just when they visit the messages page.

**File:** `apps/wc-booking/src/components/messaging/messaging-provider.tsx`

**Features:**
- Auto-connects WebSocket when user is authenticated
- Auto-disconnects when user logs out
- Handles cleanup on unmount
- Prevents multiple initialization attempts

**Integration:** Added to `apps/wc-booking/src/app/providers.tsx` to wrap the entire app.

### 2. **Connection-Aware Join Logic** ✅

Updated `setActiveConversation` in the messaging store to wait for WebSocket connection before attempting to join a conversation.

**File:** `packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts`

**Changes:**
- Checks if WebSocket is connected before joining
- If not connected, polls for connection with 100ms intervals
- Timeout after 5 seconds with clear error message
- Prevents "not connected" errors

### 3. **Auto-Rejoin on Reconnection** ✅

Added logic to automatically rejoin the active conversation when WebSocket reconnects (e.g., after network interruption).

**File:** `packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts`

**Changes:**
- Listen for WebSocket `connect` event
- Automatically rejoin active conversation if one exists
- Ensures users don't lose their conversation context after reconnection

### 4. **Removed Duplicate Initialization** ✅

Removed WebSocket initialization from the messages page since it's now handled globally by `MessagingProvider`.

**File:** `apps/wc-booking/src/app/messages/page.tsx`

**Changes:**
- Removed `initialize()` and `cleanup()` calls
- Removed these from destructured store values
- Kept notification permission request

## Files Modified

1. **packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts**
   - Updated `setActiveConversation` with connection-aware join logic
   - Added auto-rejoin on reconnection

2. **apps/wc-booking/src/components/messaging/messaging-provider.tsx** (NEW)
   - Created provider for global WebSocket initialization

3. **apps/wc-booking/src/app/providers.tsx**
   - Added `MessagingProvider` to app providers

4. **apps/wc-booking/src/app/messages/page.tsx**
   - Removed duplicate initialization logic

## Testing Instructions

### Prerequisites
- Ensure backend WebSocket server is running on the configured port (default: 3001)
- Have a test user account with authentication
- Have a camp with a provider configured

### Test Case 1: Message Organizer Button
1. Navigate to a camp details page (e.g., `/camps/summer-adventure-camp`)
2. Ensure you're logged in as a parent/user
3. Click the "Message organizer" button
4. **Expected:** 
   - No console errors
   - Successfully navigates to `/messages/{conversationId}`
   - Conversation loads with messages
   - WebSocket connection indicator shows "connected"

### Test Case 2: Direct Messages Navigation
1. Log in as a parent/user
2. Navigate directly to `/messages`
3. **Expected:**
   - WebSocket connects automatically
   - Conversations list loads
   - No "not connected" errors in console

### Test Case 3: WebSocket Reconnection
1. Open messages page with an active conversation
2. Simulate network interruption (disable network in DevTools)
3. Re-enable network
4. **Expected:**
   - WebSocket reconnects automatically
   - Active conversation is rejoined
   - Messages continue to work

### Test Case 4: Logout/Login Cycle
1. Log in and navigate to messages (WebSocket connects)
2. Log out
3. **Expected:** WebSocket disconnects and cleans up
4. Log in again
5. **Expected:** WebSocket reconnects automatically

## Console Logs to Monitor

When testing, watch for these console logs:

✅ **Success indicators:**
```
[MessagingProvider] User authenticated, initializing messaging store...
[MessagingStore] Initializing messaging store...
[MessagingStore] WebSocket connected
[MessagingStore] Setting active conversation: {conversationId}
[MessagingStore] WebSocket connected, joining conversation: {conversationId}
```

❌ **Error indicators (should NOT appear):**
```
[WebSocketService] Cannot join conversation: not connected
[WebSocketService] Cannot join conversation: not authenticated
```

## Benefits

1. **Eliminates Race Condition:** WebSocket is connected before users can trigger conversation joins
2. **Better User Experience:** No errors when clicking "Message organizer"
3. **Resilient to Network Issues:** Auto-reconnects and rejoins conversations
4. **Cleaner Architecture:** Single source of truth for WebSocket initialization
5. **Consistent Behavior:** WebSocket state is managed globally, not per-page

## Rollback Plan

If issues arise, you can rollback by:

1. Remove `MessagingProvider` from `apps/wc-booking/src/app/providers.tsx`
2. Restore initialization in `apps/wc-booking/src/app/messages/page.tsx`
3. Revert changes to `packages/wc-frontend-utils/src/lib/messaging/store/create-messaging-store.ts`

## Future Improvements

1. Add loading state indicator while WebSocket is connecting
2. Add retry button if WebSocket connection fails
3. Show user-friendly error messages for connection issues
4. Add WebSocket connection status indicator in UI
5. Implement exponential backoff for connection retries

