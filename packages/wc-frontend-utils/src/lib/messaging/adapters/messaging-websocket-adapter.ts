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

import { WsClientEvent, WsServerEvent } from '@world-schools/wc-types'
import type { GlobalWebSocketService } from '../../websocket/create-websocket-service'

export interface MessagingWebSocketAdapter {
  // Message operations
  sendMessage(
    conversationId: string,
    content: string,
    tempId: string,
    options?: { attachmentIds?: string[] }
  ): void
  joinConversation(conversationId: string): void
  leaveConversation(conversationId: string): void
  onMessageCreated(handler: (data: any) => void): () => void
  onMessageNew(handler: (data: any) => void): () => void
  onMessageUpdated(handler: (data: any) => void): () => void
  onMessageDeleted(handler: (data: any) => void): () => void
  onMessageError(handler: (data: any) => void): () => void
  isConnected(): boolean

  // Typing indicators
  startTyping(conversationId: string): void
  stopTyping(conversationId: string): void
  onTypingStart(handler: (data: any) => void): () => void
  onTypingStop(handler: (data: any) => void): () => void

  // Presence
  updatePresence(status: 'online' | 'away' | 'offline'): void
  onPresenceUpdate(handler: (data: any) => void): () => void

  // Receipts
  markAsRead(messageId: string, conversationId: string): void
  markAsDelivered(messageId: string, conversationId: string, deliveryLatencyMs?: number): void
  onReadReceipt(handler: (data: any) => void): () => void
  onDeliveredReceipt(handler: (data: any) => void): () => void

  // Conversation events
  onConversationNew(handler: (data: any) => void): () => void

  // Connection lifecycle
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
    sendMessage(
      conversationId: string,
      content: string,
      tempId: string,
      options?: { attachmentIds?: string[] }
    ) {
      wsService.emit(WsClientEvent.SendMessage, {
        conversationId,
        content,
        tempId,
        ...(options?.attachmentIds?.length ? { attachmentIds: options.attachmentIds } : {}),
      })
    },

    joinConversation(conversationId: string) {
      wsService.emit(WsClientEvent.JoinConversation, { conversationId })
    },

    leaveConversation(conversationId: string) {
      wsService.emit(WsClientEvent.LeaveConversation, { conversationId })
    },

    onMessageCreated(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.MessageCreated, handler)
    },

    onMessageNew(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.MessageNew, handler)
    },

    onMessageUpdated(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.MessageUpdated, handler)
    },

    onMessageDeleted(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.MessageDeleted, handler)
    },

    onMessageError(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.MessageError, handler)
    },

    isConnected() {
      return wsService.isConnected()
    },

    // Typing indicators
    startTyping(conversationId: string) {
      wsService.emit(WsClientEvent.TypingStart, { conversationId })
    },

    stopTyping(conversationId: string) {
      wsService.emit(WsClientEvent.TypingStop, { conversationId })
    },

    onTypingStart(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.TypingStart, handler)
    },

    onTypingStop(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.TypingStop, handler)
    },

    // Presence
    updatePresence(status: 'online' | 'away' | 'offline') {
      wsService.emit(WsClientEvent.PresenceUpdate, { status })
    },

    onPresenceUpdate(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.PresenceUpdate, handler)
    },

    // Receipts
    markAsRead(messageId: string, conversationId: string) {
      wsService.emit(WsClientEvent.MessageRead, { messageId, conversationId })
    },

    markAsDelivered(messageId: string, conversationId: string, deliveryLatencyMs?: number) {
      wsService.emit(WsClientEvent.MessageDelivered, {
        messageId,
        conversationId,
        deliveryLatencyMs,
      })
    },

    onReadReceipt(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.ReceiptRead, handler)
    },

    onDeliveredReceipt(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.ReceiptDelivered, handler)
    },

    // Conversation events
    onConversationNew(handler: (data: any) => void) {
      return wsService.on(WsServerEvent.ConversationNew, handler)
    },

    // Connection lifecycle
    onConnected(handler: () => void) {
      return wsService.on('connection:established', handler)
    },

    onDisconnected(handler: (data: any) => void) {
      return wsService.on('connection:lost', handler)
    },
  }
}
