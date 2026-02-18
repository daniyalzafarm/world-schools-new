/**
 * Message Queue for Offline Support
 *
 * Queues messages when WebSocket is disconnected and automatically
 * retries them when the connection is restored.
 *
 * Features:
 * - localStorage persistence across page refreshes
 * - Max 3 retry attempts per message
 * - Exponential backoff (1s, 2s, 4s)
 * - Automatic queue processing on reconnection
 *
 * @example
 * ```typescript
 * import { MessageQueue } from './message-queue'
 *
 * const queue = new MessageQueue()
 * queue.load()
 *
 * // Queue a message when offline
 * queue.enqueue('conv-123', 'Hello!', 'temp-456')
 *
 * // Process queue when connection is restored
 * await queue.processQueue(async (conversationId, content, tempId) => {
 *   messagingWebSocket.sendMessage(conversationId, content, tempId)
 * })
 * ```
 */

export interface QueuedMessage {
  tempId: string
  conversationId: string
  content: string
  timestamp: number
  retryCount: number
}

const STORAGE_KEY = 'wc_message_queue'

export class MessageQueue {
  private queue: QueuedMessage[] = []
  private maxRetries = 3
  private baseDelay = 1000 // 1 second (exponential backoff: 1s, 2s, 4s)
  private processing = false

  /**
   * Add a message to the queue
   */
  enqueue(conversationId: string, content: string, tempId: string) {
    // Avoid duplicate entries
    if (this.queue.some(m => m.tempId === tempId)) {
      return
    }

    this.queue.push({
      tempId,
      conversationId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
    })

    this.persist()
  }

  /**
   * Process all queued messages with exponential backoff
   * @param sendFn - Function to send a message (should throw on failure)
   */
  async processQueue(
    sendFn: (conversationId: string, content: string, tempId: string) => void
  ): Promise<{ sent: string[]; failed: string[] }> {
    if (this.processing || this.queue.length === 0) {
      return { sent: [], failed: [] }
    }

    this.processing = true
    const sent: string[] = []
    const failed: string[] = []
    const messages = [...this.queue]

    for (const msg of messages) {
      try {
        // Calculate delay based on retry count (exponential backoff: 1s, 2s, 4s)
        if (msg.retryCount > 0) {
          const delay = this.baseDelay * Math.pow(2, msg.retryCount - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        sendFn(msg.conversationId, msg.content, msg.tempId)
        this.remove(msg.tempId)
        sent.push(msg.tempId)
      } catch {
        msg.retryCount++
        if (msg.retryCount >= this.maxRetries) {
          failed.push(msg.tempId)
          this.remove(msg.tempId)
        }
      }
    }

    this.persist()
    this.processing = false
    return { sent, failed }
  }

  /**
   * Remove a message from the queue
   */
  remove(tempId: string) {
    this.queue = this.queue.filter(m => m.tempId !== tempId)
    this.persist()
  }

  /**
   * Persist queue to localStorage
   */
  private persist() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue))
      } catch {
        // localStorage may be full or unavailable
        console.warn('[MessageQueue] Failed to persist queue to localStorage')
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  load() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          this.queue = JSON.parse(stored)
        }
      } catch {
        // Invalid JSON or localStorage unavailable
        console.warn('[MessageQueue] Failed to load queue from localStorage')
        this.queue = []
      }
    }
  }

  /**
   * Get the number of queued messages
   */
  get size() {
    return this.queue.length
  }

  /**
   * Get all queued messages (read-only copy)
   */
  getAll(): readonly QueuedMessage[] {
    return [...this.queue]
  }

  /**
   * Check if a message is in the queue
   */
  has(tempId: string): boolean {
    return this.queue.some(m => m.tempId === tempId)
  }

  /**
   * Clear all queued messages
   */
  clear() {
    this.queue = []
    this.persist()
  }
}

export const messageQueue = new MessageQueue()
