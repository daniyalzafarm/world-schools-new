/**
 * Event Bus for World Camps Applications
 *
 * A simple pub/sub event system for cross-component communication.
 * Useful for coordinating UI state across components without prop drilling.
 *
 * @example
 * ```typescript
 * import { eventBus } from '@world-schools/wc-utils'
 *
 * // Subscribe to an event
 * eventBus.$on('sidebar:toggle', 'my-component', (data) => {
 *   console.log('Sidebar toggled:', data)
 * })
 *
 * // Emit an event
 * eventBus.$emit('sidebar:toggle', { isOpen: true })
 *
 * // Unsubscribe from an event
 * eventBus.$off('sidebar:toggle', 'my-component')
 * ```
 */

// Define a type for the callback function
type EventCallback = (data: any, key: string) => void

// Define the interface for the event bus
interface EventBusType {
  // Mapping from event names to a mapping of subscription IDs to callbacks
  callbacks: {
    [eventName: string]: { [subscriptionId: string]: EventCallback }
  }
  // Registers a callback for an event with a unique subscription ID
  $on: (eventName: string, subscriptionId: string, callback: EventCallback) => void
  // Emits an event with associated data and key to all registered callbacks
  $emit: (eventName: string, data?: any) => void
  // Un-registers a callback for a specific event using its subscription ID
  $off: (eventName: string, subscriptionId: string) => void
}

// Create the event bus with improved clarity and type safety
const eventBus: EventBusType = {
  callbacks: {},

  $on(eventName, subscriptionId, callback) {
    if (!this.callbacks[eventName]) {
      this.callbacks[eventName] = {}
    }
    this.callbacks[eventName][subscriptionId] = callback
  },

  $emit(eventName, data = null) {
    if (this.callbacks[eventName]) {
      // Iterate over all callbacks registered for the event and invoke them
      Object.values(this.callbacks[eventName]).forEach((callback: any) => {
        callback(data)
      })
    }
  },

  $off(eventName, subscriptionId) {
    if (this.callbacks[eventName]) {
      delete this.callbacks[eventName][subscriptionId]
    }
  },
}

export { eventBus, type EventCallback, type EventBusType }
export default eventBus

