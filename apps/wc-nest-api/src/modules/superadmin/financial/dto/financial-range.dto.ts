import { AnalyticsRangeDto } from '../../analytics/dto/analytics-range.dto'

/**
 * Identical shape to AnalyticsRangeDto. Extending preserves separation of concerns
 * (financial-only filters can be added here without polluting the analytics DTO).
 */
export class FinancialRangeDto extends AnalyticsRangeDto {}
