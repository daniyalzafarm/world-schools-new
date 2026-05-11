/**
 * Parent dashboard journey state. Determines which container/sections render
 * on the home dashboard. States `quotes-pending` and `decision-time` are
 * declared here for future quote-flow work — they are never produced by the
 * v1 classifier (no quote service yet).
 */
export type DashboardState =
  | 'fresh-start'
  | 'profile-ready'
  | 'browsing'
  | 'quotes-pending'
  | 'decision-time'
  | 'first-booking'
  | 'pre-camp'
  | 'during-camp'
  | 'post-camp'
  | 'returning-user'
