/**
 * Centralized emoji constants for World Camps applications
 *
 * Usage:
 * import { EMOJI } from '@world-schools/wc-frontend-utils'
 * <span className="icon">{EMOJI.TIMER}</span>
 *
 * Always include role="img" and aria-label when using emoji for semantic meaning:
 * <span role="img" aria-label="Timer">{EMOJI.TIMER}</span>
 */

export const EMOJI = {
  // Time & Calendar
  TIMER: '⏱️',
  CLOCK: '🕐',
  CALENDAR: '📅',
  HOURGLASS: '⏳',

  // Communication
  EMAIL: '📧',
  MESSAGE: '💬',
  PHONE: '📞',
  BELL: '🔔',

  // Status & Feedback
  CHECK: '✅',
  CHECK_MARK: '✅',
  CROSS: '❌',
  CROSS_MARK: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  STAR: '⭐',
  QUESTION: '❓',
  SHIELD: '🛡️',

  // Celebration & Emotion
  PARTY: '🎉',
  PARTY_POPPER: '🎉',
  CONFETTI: '🎊',
  CLAP: '👏',
  SPARKLES: '✨',
  TROPHY: '🏆',

  // Analytics & Data
  CHART: '📊',
  GRAPH: '📈',
  DOCUMENT: '📄',
  CLIPBOARD: '📋',

  // Camp & Activities
  TENT: '🏕️',
  SUN: '☀️',
  TREE: '🌲',
  MOUNTAIN: '⛰️',

  // Actions & Objects
  UPLOAD: '📤',
  DOWNLOAD: '📥',
  SEARCH: '🔍',
  MAGNIFYING_GLASS: '🔍',
  LOCK: '🔒',
  KEY: '🔑',
  TRASH: '🗑️',
  REFRESH: '🔄',
  ROCKET: '🚀',

  // People & Roles
  USER: '👤',

  // Finance
  CREDIT_CARD: '💳',

  // Navigation
  ARROW_LEFT: '←',
  ARROW_RIGHT: '→',
} as const

export type EmojiKey = keyof typeof EMOJI

