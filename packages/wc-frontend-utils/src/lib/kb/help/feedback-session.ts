/**
 * Persistent session ID for anonymous article feedback (localStorage).
 * Shared across help module so one session = one vote per article.
 */

export const FEEDBACK_SESSION_KEY = 'kb_feedback_session'

export function getOrCreateFeedbackSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(FEEDBACK_SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(FEEDBACK_SESSION_KEY, id)
  }
  return id
}
