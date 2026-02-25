/**
 * Static configuration for global discount types
 * This defines the metadata for all 6 discount categories without requiring database entries
 */

export interface DiscountTypeConfig {
  category: string
  title: string
  icon: string
  description: string
  allowMultipleEntries: boolean
  sortOrder: number
  defaultEntry?: any
}

/**
 * All 6 global discount type configurations
 * These are displayed in the ManageDiscountsPanel regardless of database state
 */
export const DISCOUNT_TYPES: DiscountTypeConfig[] = [
  {
    category: 'early_bird',
    title: 'Early Bird',
    icon: '🎯',
    description: 'Reward early bookings',
    allowMultipleEntries: false,
    sortOrder: 1,
    defaultEntry: {
      id: 'entry-1',
      name: 'Early Bird',
      value: 10,
      calculationType: 'percent',
      validUntil: null,
      details: 'Reward early bookings',
    },
  },
  {
    category: 'sibling',
    title: 'Sibling Discount',
    icon: '👨‍👩‍👧‍👦',
    description: 'Discounts for multiple children',
    allowMultipleEntries: false,
    sortOrder: 2,
    defaultEntry: {
      id: 'entry-1',
      name: 'Sibling Discount',
      calculationType: 'percent',
      details: 'Discounts for multiple children',
      config: {
        secondChild: 10,
        thirdChild: 15,
        fourthPlusChild: 20,
      },
    },
  },
  {
    category: 'returning_camper',
    title: 'Returning Camper',
    icon: '🔄',
    description: 'Loyalty discount',
    allowMultipleEntries: false,
    sortOrder: 3,
    defaultEntry: {
      id: 'entry-1',
      name: 'Returning Camper',
      value: 5,
      calculationType: 'percent',
      details: 'Loyalty discount for returning campers',
    },
  },
  {
    category: 'multi_week',
    title: 'Multi-Week Booking',
    icon: '📅',
    description: 'Volume pricing & consecutive weeks',
    allowMultipleEntries: true,
    sortOrder: 4,
  },
  {
    category: 'group_booking',
    title: 'Group Booking',
    icon: '👥',
    description: 'Schools, clubs & organizations',
    allowMultipleEntries: true,
    sortOrder: 5,
  },
  {
    category: 'promo_code',
    title: 'Promo Codes',
    icon: '🎟️',
    description: 'Custom promotional codes',
    allowMultipleEntries: true,
    sortOrder: 6,
  },
]

/**
 * Get discount type configuration by category
 */
export function getDiscountTypeConfig(category: string): DiscountTypeConfig | undefined {
  return DISCOUNT_TYPES.find(dt => dt.category === category)
}

/**
 * Get all discount type categories
 */
export function getAllDiscountCategories(): string[] {
  return DISCOUNT_TYPES.map(dt => dt.category)
}

