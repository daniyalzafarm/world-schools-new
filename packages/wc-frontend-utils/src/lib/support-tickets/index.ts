// Service factory
export {
  createSupportTicketsService,
  type SupportTicketsApiClient,
  type SupportTicketsServiceInstance,
} from './create-support-tickets-service'

// UI utility functions
export {
  filterByTab,
  getStatusChipColorClass,
  getStatusIconColorClass,
  getPriorityBadgeClass,
  ticketPreviewText,
  formatRelativeTime,
  formatStartedLabel,
  messageToUiMessage,
  OPEN_TAB_STATUSES,
  CLOSED_TAB_STATUSES,
  type TabId,
} from './support-tickets-ui-utils'

// Shared hooks
export { useSupportTicketsList } from './use-support-tickets-list'
export {
  useNewSupportTicketForm,
  type UseNewSupportTicketFormOptions,
  type UseNewSupportTicketFormResult,
} from './use-new-support-ticket-form'
export { useSupportTicketCategories } from './use-support-ticket-categories'

// Shared components
export {
  SupportTicketsListContent,
  type SupportTicketsListContentProps,
} from './SupportTicketsListContent'
export {
  NewSupportTicketFormContent,
  type NewSupportTicketFormContentProps,
} from './NewSupportTicketFormContent'
export {
  SupportTicketDetailContent,
  type SupportTicketDetailContentProps,
} from './SupportTicketDetailContent'
export { SlaProgressBar, type SlaProgressBarProps } from './SlaProgressBar'
