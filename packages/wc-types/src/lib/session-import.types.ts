export interface SessionImportColumn {
  key: string
  label: string
  description: string
  required: boolean
  type: 'string' | 'number' | 'enum'
  options?: string[]
  example: string
  /** If true, only applicable to day camps. */
  dayOnly?: boolean
}

export const SESSION_IMPORT_COLUMNS: SessionImportColumn[] = [
  {
    key: 'name',
    label: 'Session Name',
    description: 'Display name for the session. Max 60 characters.',
    required: true,
    type: 'string',
    example: 'Summer Week 1',
  },
  {
    key: 'startDate',
    label: 'Start Date',
    description: 'Session start date in YYYY-MM-DD format (e.g. 2026-07-07).',
    required: true,
    type: 'string',
    example: '2026-07-07',
  },
  {
    key: 'endDate',
    label: 'End Date',
    description: 'Session end date in YYYY-MM-DD format. Must be after the start date.',
    required: true,
    type: 'string',
    example: '2026-07-11',
  },
  {
    key: 'pricingType',
    label: 'Pricing Type',
    description:
      "How the session price is structured. Use 'single' for one price for all participants, or 'age_group' to set different prices per age group (requires ageGroupPrices).",
    required: true,
    type: 'enum',
    options: ['single', 'age_group'],
    example: 'single',
  },
  {
    key: 'price',
    label: 'Price',
    description:
      "Session price in the provider's currency (e.g. 1200 = £1,200). Required when pricingType is 'single'. Must be 0 or greater.",
    required: false,
    type: 'number',
    example: '1200',
  },
  {
    key: 'ageGroupPrices',
    label: 'Age Group Prices',
    description:
      "Prices per age group. Required when pricingType is 'age_group'. Format: ageGroupId:price pairs separated by commas. Age group IDs must match the camp's configured age groups (e.g. 8-12 or 13-17).",
    required: false,
    type: 'string',
    example: '8-12:1200,13-17:1500',
  },
  {
    key: 'availabilityType',
    label: 'Availability Type',
    description:
      "How session capacity is managed. Use 'single' for one total capacity, or 'age_group' to set spots per age group (requires ageGroupSpots).",
    required: true,
    type: 'enum',
    options: ['single', 'age_group'],
    example: 'single',
  },
  {
    key: 'totalSpots',
    label: 'Total Spots',
    description:
      "Total number of available places. Required when availabilityType is 'single'. Must be between 1 and 10,000.",
    required: false,
    type: 'number',
    example: '50',
  },
  {
    key: 'ageGroupSpots',
    label: 'Age Group Spots',
    description:
      "Capacity per age group. Required when availabilityType is 'age_group'. Format: ageGroupId:spots pairs separated by commas. Age group IDs must match the camp's configured age groups.",
    required: false,
    type: 'string',
    example: '8-12:50,13-17:30',
  },
  {
    key: 'sessionDayType',
    label: 'Session Day Type',
    description:
      "Day camps only. Use 'full_day' for a standard full-day session or 'half_day' for a morning/afternoon session.",
    required: false,
    type: 'enum',
    options: ['full_day', 'half_day'],
    example: 'full_day',
    dayOnly: true,
  },
  {
    key: 'arrivalTime',
    label: 'Arrival Time',
    description:
      "Day camps only. Required when sessionDayType is 'half_day'. Time participants arrive, in 24-hour HH:MM format (e.g. 09:00). Must be before departureTime.",
    required: false,
    type: 'string',
    example: '09:00',
    dayOnly: true,
  },
  {
    key: 'departureTime',
    label: 'Departure Time',
    description:
      "Day camps only. Required when sessionDayType is 'half_day'. Time participants depart, in 24-hour HH:MM format (e.g. 13:00). Must be after arrivalTime.",
    required: false,
    type: 'string',
    example: '13:00',
    dayOnly: true,
  },
  {
    key: 'status',
    label: 'Status',
    description:
      "Publication status of the session. 'draft' sessions are not visible to parents; 'published' sessions appear in search results and are open for booking. Defaults to 'published' if omitted.",
    required: false,
    type: 'enum',
    options: ['draft', 'published'],
    example: 'published',
  },
]
