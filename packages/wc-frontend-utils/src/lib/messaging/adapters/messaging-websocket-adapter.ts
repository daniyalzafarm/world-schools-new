/**
 * Messaging WebSocket Adapter
 *
 * Adapts the global WebSocket service for messaging-specific events.
 * This allows the messaging module to use WebSocket without tight coupling
 * to the global WebSocket service implementation.
 *
 * Follows the Adapter Pattern to decouple the messaging module from
 * the global WebSocket service, enabling independent evolution of both.
 *
 * @example
 * ```typescript
 * import { createMessagingWebSocketAdapter } from '@world-schools/wc-frontend-utils'
 *
 * const adapter = createMessagingWebSocketAdapter(globalWsService)
 * adapter.sendMessage('conv-123', 'Hello!', 'temp-456')
 * adapter.onMessageNew((data) => console.log('New message:', data))
 * ```
 */

import type { GlobalWebSocketService } from '../../websocket/create-websocket-service'

export interface MessagingWebSocketAdapter {
  // Message operations
  sendMessage(conversationId: string, content: string, tempId: string): void
  joinConversation(conversationId: string): void
  leaveConversation(conversationId: string): void
  onMessageCreated(handler: (data: any) => void): () => void
  onMessageNew(handler: (data: any) => void): () => void
  onMessageError(handler: (data: any) => void): () => void
  isConnected(): boolean

  // Typing indicators (Phase D)
  startTyping(conversationId: string): void
  stopTyping(conversationId: string): void
  onTypingStart(handler: (data: any) => void): () => void
  onTypingStop(handler: (data: any) => void): () => void

  // Presence (Phase D)
  updatePresence(status: 'online' | 'away' | 'offline'): void
  onPresenceUpdate(handler: (data: any) => void): () => void

  // Receipts (Phase D)
  markAsRead(messageId: string, conversationId: string): void
  markAsDelivered(messageId: string, conversationId: string, deliveryLatencyMs?: number): void
  onReadReceipt(handler: (data: any) => void): () => void
  onDeliveredReceipt(handler: (data: any) => void): () => void

  // Conversation events
  onConversationNew(handler: (data: any) => void): () => void

  // Connection lifecycle (Phase E)
  onConnected(handler: () => void): () => void
  onDisconnected(handler: (data: any) => void): () => void
}

/**
 * Creates a messaging WebSocket adapter from a global WebSocket service
 *
 * Translates messaging-specific method calls into global WebSocket events.
 * This ensures the messaging module only depends on the adapter interface,
 * not the global WebSocket implementation details.
 */
export function createMessagingWebSocketAdapter(
  wsService: GlobalWebSocketService
): MessagingWebSocketAdapter {
  return {
    sendMessage(conversationId: string, content: string, tempId: string) {
      wsService.emit('send_message', {
        conversationId,
        content,
        tempId,
      })
    },

    joinConversation(conversationId: string) {
      wsService.emit('join_conversation', { conversationId })
    },

    leaveConversation(conversationId: string) {
      wsService.emit('leave_conversation', { conversationId })
    },

    onMessageCreated(handler: (data: any) => void) {
      return wsService.on('message:created', handler)
    },

    onMessageNew(handler: (data: any) => void) {
      return wsService.on('message:new', handler)
    },

    onMessageError(handler: (data: any) => void) {
      return wsService.on('message:error', handler)
    },

    isConnected() {
      return wsService.isConnected()
    },

    // Typing indicators (Phase D)
    startTyping(conversationId: string) {
      wsService.emit('typing:start', { conversationId })
    },

    stopTyping(conversationId: string) {
      wsService.emit('typing:stop', { conversationId })
    },

    onTypingStart(handler: (data: any) => void) {
      return wsService.on('typing:start', handler)
    },

    onTypingStop(handler: (data: any) => void) {
      return wsService.on('typing:stop', handler)
    },

    // Presence (Phase D)
    updatePresence(status: 'online' | 'away' | 'offline') {
      wsService.emit('presence:update', { status })
    },

    onPresenceUpdate(handler: (data: any) => void) {
      return wsService.on('presence:update', handler)
    },

    // Receipts (Phase D)
    markAsRead(messageId: string, conversationId: string) {
      wsService.emit('message:read', { messageId, conversationId })
    },

    markAsDelivered(messageId: string, conversationId: string, deliveryLatencyMs?: number) {
      wsService.emit('message:delivered', { messageId, conversationId, deliveryLatencyMs })
    },

    onReadReceipt(handler: (data: any) => void) {
      return wsService.on('receipt:read', handler)
    },

    onDeliveredReceipt(handler: (data: any) => void) {
      return wsService.on('receipt:delivered', handler)
    },

    // Conversation events
    onConversationNew(handler: (data: any) => void) {
      return wsService.on('conversation:new', handler)
    },

    // Connection lifecycle (Phase E)
    onConnected(handler: () => void) {
      return wsService.on('connection:established', handler)
    },

    onDisconnected(handler: (data: any) => void) {
      return wsService.on('connection:lost', handler)
    },
  }
}
