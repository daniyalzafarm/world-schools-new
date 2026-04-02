export type ReviewStatus = 'draft' | 'pending' | 'published' | 'rejected'
export type ReviewTagDimension = 'happiness' | 'safety' | 'communication'

export interface ReviewTagDefinition {
  value: string
  title: string
  description?: string
}

export interface ReviewTagDimensionConfig {
  dimension: ReviewTagDimension
  label: string
  tags: ReviewTagDefinition[]
}

export const REVIEW_TAG_CONFIG: Record<ReviewTagDimension, ReviewTagDimensionConfig> = {
  happiness: {
    dimension: 'happiness',
    label: "Kid's Experience",
    tags: [
      { value: 'didnt_want_to_leave', title: "Didn't want to leave" },
      { value: 'made_great_friends', title: 'Made great friends' },
      { value: 'best_camp_ever', title: 'Best camp ever' },
      { value: 'loved_activities', title: 'Loved the activities' },
      { value: 'exceeded_expectations', title: 'Exceeded expectations' },
      { value: 'settled_in_quickly', title: 'Settled in quickly' },
      { value: 'mixed_experience', title: 'Mixed experience' },
    ],
  },
  safety: {
    dimension: 'safety',
    label: 'Safety',
    tags: [
      { value: 'always_supervised', title: 'Always supervised' },
      { value: 'great_staff_ratio', title: 'Great staff ratio' },
      { value: 'safety_rules_clear', title: 'Safety rules were clear' },
      { value: 'felt_reassured', title: 'Felt completely reassured' },
      { value: 'activities_felt_safe', title: 'Activities felt safe' },
      { value: 'age_appropriate', title: 'Activities were age-appropriate' },
      { value: 'fast_incident_response', title: 'Fast incident response' },
      { value: 'first_aid_on_site', title: 'First aid on site' },
    ],
  },
  communication: {
    dimension: 'communication',
    label: 'Communication',
    tags: [
      { value: 'daily_photo_video', title: 'Daily Photo/Video Updates' },
      { value: 'quick_to_respond', title: 'Quick to respond' },
      { value: 'regular_updates', title: 'Regular updates' },
      { value: 'pre_camp_info_clear', title: 'Pre-camp info was clear' },
      { value: 'staff_approachable', title: 'Staff were approachable' },
      { value: 'could_communicate_more', title: 'Could communicate more' },
    ],
  },
}

export const getTagDefinition = (
  dimension: ReviewTagDimension,
  value: string
): ReviewTagDefinition | undefined => REVIEW_TAG_CONFIG[dimension].tags.find(t => t.value === value)

export const REVIEW_TAG_DIMENSIONS = Object.keys(REVIEW_TAG_CONFIG) as ReviewTagDimension[]
