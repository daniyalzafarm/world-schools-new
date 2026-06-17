import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'
import { BookingGroupStatus } from '../../../../generated/client/enums'

export const PARENT_BOOKING_TABS = ['drafts', 'upcoming', 'past', 'cancelled'] as const

export type ParentBookingTab = (typeof PARENT_BOOKING_TABS)[number]

export const PARENT_TAB_STATUS_LIST: Record<ParentBookingTab, BookingGroupStatus[]> = {
  drafts: [BookingGroupStatus.draft],
  upcoming: [
    BookingGroupStatus.request,
    BookingGroupStatus.accepted,
    BookingGroupStatus.deposit_paid,
    BookingGroupStatus.fully_paid,
    BookingGroupStatus.at_camp,
    BookingGroupStatus.expired,
    BookingGroupStatus.declined,
  ],
  past: [BookingGroupStatus.completed],
  cancelled: [BookingGroupStatus.cancelled],
}

export const PARENT_BOOKING_SORT_FIELDS = [
  'updatedAt',
  'requestedAt',
  'totalAmount',
  'sessionStart',
] as const

export type ParentBookingSortField = (typeof PARENT_BOOKING_SORT_FIELDS)[number]

export class QueryParentBookingGroupsDto {
  @ApiPropertyOptional({
    description: 'Lifecycle tab (status group)',
    enum: PARENT_BOOKING_TABS,
    default: 'upcoming',
  })
  @IsOptional()
  @IsIn([...PARENT_BOOKING_TABS])
  tab?: ParentBookingTab

  @ApiPropertyOptional({
    description: 'Narrow to one booking status (must belong to the selected tab group)',
    enum: BookingGroupStatus,
  })
  @IsOptional()
  @IsIn(Object.values(BookingGroupStatus))
  status?: BookingGroupStatus

  @ApiPropertyOptional({ description: 'Filter to booking groups that include this child' })
  @IsOptional()
  @IsUUID()
  childId?: string

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: PARENT_BOOKING_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn([...PARENT_BOOKING_SORT_FIELDS])
  sortBy?: ParentBookingSortField

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc'

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number
}
