/**
 * Barrel export file for all messaging DTOs
 */

// Conversation DTOs
export {
  CreateConversationDto,
  GetConversationsDto,
  UpdateConversationSettingsDto,
  AssignConversationDto,
  UpdateConversationStatusDto,
  AddLabelDto,
  RemoveLabelDto,
  CreateLabelDto,
  ConversationMetricsDto,
} from './conversation.dto'

// Message DTOs
export {
  SendMessageDto,
  GetMessagesDto,
  EditMessageDto,
  DeleteMessageDto,
  MarkAsReadDto,
  MarkAsDeliveredDto,
  AddReactionDto,
  RemoveReactionDto,
  BookmarkMessageDto,
  UnbookmarkMessageDto,
  PinMessageDto,
  UnpinMessageDto,
  ForwardMessageDto,
  ScheduleMessageDto,
  ReportMessageDto,
} from './message.dto'

// Search DTOs
export { SearchMessagesDto, SearchConversationsDto } from './search.dto'

// Participant DTOs
export {
  AddParticipantDto,
  RemoveParticipantDto,
  UpdateParticipantSettingsDto,
} from './participant.dto'

// Mention DTOs
export { CreateMentionDto, GetMentionsDto } from './mention.dto'

// Report DTOs
export {
  CreateReportDto,
  UpdateReportStatusDto,
  GetReportsDto,
  ModerationAction,
  TakeModerationActionDto,
} from './report.dto'

// GDPR DTOs
export {
  ExportUserDataDto,
  DeleteUserDataDto,
  ExportDataResponseDto,
  DeleteDataResponseDto,
} from './gdpr.dto'

// Response DTOs
export {
  UserResponseDto,
  ProviderResponseDto,
  ParticipantResponseDto,
  MessageResponseDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
  PaginatedMessagesResponseDto,
  ReadReceiptResponseDto,
  DeliveryReceiptResponseDto,
  ReactionResponseDto,
  MentionResponseDto,
  EditHistoryResponseDto,
  BookmarkResponseDto,
  LabelResponseDto,
  LabelAssignmentResponseDto,
  ReportResponseDto,
  SearchResultsResponseDto,
  ConversationMetricsResponseDto,
  SuccessResponseDto,
  ErrorResponseDto,
} from './response.dto'
