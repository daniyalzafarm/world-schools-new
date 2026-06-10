import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { BookingGroupStatus } from '../../../../generated/client/enums'

/** Non-draft statuses allowed on provider booking list */
export const PROVIDER_BOOKING_LIST_STATUSES: BookingGroupStatus[] = [
  BookingGroupStatus.request,
  BookingGroupStatus.accepted,
  BookingGroupStatus.declined,
  BookingGroupStatus.expired,
  BookingGroupStatus.deposit_paid,
  BookingGroupStatus.fully_paid,
  BookingGroupStatus.at_camp,
  BookingGroupStatus.completed,
  BookingGroupStatus.cancelled,
]

export const PROVIDER_BOOKING_SORT_FIELDS = [
  'updatedAt',
  'requestedAt',
  'totalAmount',
  'sessionStart',
  'status',
  'bookingGroupNumber',
  'parentFirstName',
  'sessionName',
] as const

export type ProviderBookingSortField = (typeof PROVIDER_BOOKING_SORT_FIELDS)[number]

export const PROVIDER_BOOKING_TABS = [
  'all',
  'requests',
  'upcoming',
  'at-camp',
  'past',
  'expired',
  'declined',
  'cancelled',
] as const

export type ProviderBookingTab = (typeof PROVIDER_BOOKING_TABS)[number]

export class QueryProviderBookingGroupsDto {
  @ApiPropertyOptional({
    description: 'Lifecycle tab (status group)',
    enum: PROVIDER_BOOKING_TABS,
    default: 'requests',
  })
  @IsOptional()
  @IsIn([...PROVIDER_BOOKING_TABS])
  tab?: ProviderBookingTab

  @ApiPropertyOptional({ description: 'Search reference, parent, camp, session, child name' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Narrow to one booking status (must belong to the selected tab group)',
    enum: BookingGroupStatus,
  })
  @IsOptional()
  @IsIn(PROVIDER_BOOKING_LIST_STATUSES)
  status?: BookingGroupStatus

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: PROVIDER_BOOKING_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn([...PROVIDER_BOOKING_SORT_FIELDS])
  sortBy?: ProviderBookingSortField

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
