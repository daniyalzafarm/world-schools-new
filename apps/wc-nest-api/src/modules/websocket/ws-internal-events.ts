/**
 * Internal EventEmitter2 event names used for backend-only routing.
 *
 * These are NOT Socket.io event names — they are the keys used by
 * EventEmitter2 to decouple GlobalWebSocketGateway from domain handlers.
 *
 * Two categories:
 *  - websocket:* → emitted by the gateway when a client event arrives,
 *                  consumed by domain handlers (MessagingWebSocketHandler, etc.)
 *  - booking:*   → emitted by BookingGroupsService after DB commits,
 *                  consumed by BookingWebSocketHandler
 */
export const WsInternalEvent = {
  // Gateway → MessagingWebSocketHandler routing
  SendMessage: 'websocket:send_message',
  JoinConversation: 'websocket:join_conversation',
  LeaveConversation: 'websocket:leave_conversation',
  TypingStart: 'websocket:typing_start',
  TypingStop: 'websocket:typing_stop',
  PresenceUpdate: 'websocket:presence_update',
  MessageRead: 'websocket:message_read',
  MessageDelivered: 'websocket:message_delivered',
  HeartbeatPong: 'websocket:heartbeat_pong',

  // BookingGroupsService → BookingWebSocketHandler routing
  BookingStatusChanged: 'booking:status_changed',
  BookingRequestSubmitted: 'booking:request_submitted',

  // ApplicationReviewService → ApplicationReviewWebSocketHandler routing
  OnboardingStatusChanged: 'onboarding:status_changed',
} as const
