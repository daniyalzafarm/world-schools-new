/**
 * Formats a timestamp into a human-readable relative time string
 * @param timestamp - The timestamp in milliseconds
 * @returns A formatted time string (e.g., "2 min ago", "1 hour ago", "3 days ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  // If the timestamp is in the future, return "now"
  if (diff < 0) {
    return 'now'
  }

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) {
    return 'now'
  } else if (minutes < 60) {
    return `${minutes} min ago`
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else if (weeks < 4) {
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (months < 12) {
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

/**
 * Formats a timestamp into a short relative time string for conversation items
 * @param timestamp - The timestamp in milliseconds
 * @returns A short formatted time string (e.g., "2m", "1h", "3d")
 */
export function formatShortRelativeTime(timestamp: number, suffix = ''): string {
  const now = Date.now()
  const diff = now - timestamp

  // If the timestamp is in the future, return "now"
  if (diff < 0) {
    return 'now'
  }

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  let result = ''

  if (seconds < 60) {
    result = 'now'
  } else if (minutes < 60) {
    result = `${minutes}m`
  } else if (hours < 24) {
    result = `${hours}h`
  } else if (days < 7) {
    result = `${days}d`
  } else if (weeks < 4) {
    result = `${weeks}w`
  } else if (months < 12) {
    result = `${months}mo`
  } else {
    result = `${years}y`
  }

  return suffix ? `${result} ${suffix}` : result
}

/**
 * Determines if a user is currently online based on their lastSeen timestamp
 * @param lastSeen - The timestamp when the user was last active
 * @returns true if the user is considered online (active within last 5 minutes)
 */
export function isUserOnline(lastSeen?: number): boolean {
  if (!lastSeen) return false
  const now = Date.now()
  const diff = now - lastSeen
  return diff < 5 * 60 * 1000 // 5 minutes
}

/**
 * Formats lastSeen information for display
 * @param lastSeen - The timestamp when the user was last active
 * @returns A formatted string indicating online status or last seen time
 */
export function formatLastSeen(lastSeen?: number): string {
  if (!lastSeen) return 'Offline'

  if (isUserOnline(lastSeen)) {
    return 'Online'
  }

  return `Last seen ${formatShortRelativeTime(lastSeen)}`
}

/**
 * Formats a timestamp for message display with context-aware formatting
 * Examples:
 * - "Just now" (< 1 minute)
 * - "5 min ago" (< 1 hour)
 * - "2 hours ago" (< 24 hours)
 * - "Yesterday 3:45 PM" (yesterday)
 * - "Mon 3:45 PM" (this week)
 * - "Jan 15, 3:45 PM" (this year)
 * - "Jan 15, 2024 3:45 PM" (previous years)
 *
 * @param date - The date to format (Date object, ISO string, or timestamp number)
 * @returns A formatted time string with context
 */
export function formatMessageTimestamp(date: Date | string | number): string {
  // Convert input to Date object if needed
  const dateObj = date instanceof Date ? date : new Date(date)

  // Validate the date
  if (isNaN(dateObj.getTime())) {
    console.warn('[formatMessageTimestamp] Invalid date:', date)
    return 'Invalid date'
  }

  const now = new Date()
  const diff = now.getTime() - dateObj.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  // Just now (< 1 minute)
  if (seconds < 60) {
    return 'Just now'
  }

  // X min ago (< 1 hour)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  // X hours ago (< 24 hours)
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }

  // Format time as "3:45 PM"
  const timeStr = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  // Yesterday (1 day ago)
  if (days === 1) {
    return `Yesterday ${timeStr}`
  }

  // This week (< 7 days) - show day name
  if (days < 7) {
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayName} ${timeStr}`
  }

  // This year - show month and day
  if (dateObj.getFullYear() === now.getFullYear()) {
    const monthDay = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return `${monthDay}, ${timeStr}`
  }

  // Previous years - show full date
  const fullDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${fullDate} ${timeStr}`
}

