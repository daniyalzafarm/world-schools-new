'use client'

import React from 'react'
import { Accordion, AccordionItem, Avatar, Button, Divider } from '@heroui/react'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Languages,
  MapPin,
  Star,
  X,
} from 'lucide-react'
import { cn, StarRating } from '@world-schools/ui-web'
import type { Review as ReviewType, UserProfileData } from '@/types/user-profile'

interface UserProfileSidebarProps {
  isOpen: boolean
  onClose: () => void
  profileData?: UserProfileData | null
  avatarUrl?: string
}

// Review Item Component
interface ReviewItemProps {
  review: ReviewType
  className?: string
}

function ReviewItem({ review, className }: ReviewItemProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
    }).format(date)
  }

  return (
    <div className={cn('py-4', className)}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Avatar
              src={review.reviewerAvatar}
              alt={review.reviewerName}
              size="sm"
              className="w-10 h-10 shrink-0"
              fallback={
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {review.reviewerName.charAt(0).toUpperCase()}
                  </span>
                </div>
              }
            />
            <div>
              <h4 className="text-sm font-medium">{review.reviewerName}</h4>
              {review.location && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  {review.location}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StarRating rating={review.rating} size={14} showRating={false} />
            <span className="text-xs text-secondary">{formatDate(review.date)}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{review.comment}</p>
      </div>
    </div>
  )
}

// Removed static sample data; data should be passed via props

export function UserProfileSidebar({
  isOpen,
  onClose,
  profileData,
  avatarUrl,
}: UserProfileSidebarProps) {
  // Children dropdown logic removed per requirements
  const [showAllReviews, setShowAllReviews] = React.useState(false)

  if (!isOpen) return null

  const profile = profileData?.profile
  const children = profileData?.children ?? []
  const reviews = profileData?.reviews ?? []
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3)

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="h-20 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Profile</h2>
        <Button isIconOnly variant="light" size="sm" onPress={onClose} aria-label="Close profile">
          <X size={20} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Profile header block */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">
              {profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown User'}
            </h3>
            {profile?.bio && <p className="text-sm text-secondary mt-1">{profile.bio}</p>}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {children.length} {children.length === 1 ? 'child' : 'children'}
            </p>
          </div>
          <Avatar
            src={avatarUrl ?? profile?.avatar}
            alt={profile ? `${profile.firstName} ${profile.lastName}` : 'User avatar'}
            className="w-12 h-12"
            fallback={
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {(profile?.firstName ?? 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            }
          />
        </div>

        <Divider />

        {/* About Section */}
        <div>
          <h4 className="text-lg font-semibold mb-3">About {profile?.firstName ?? 'User'}</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="inline-flex items-center gap-2">
                <Star size={16} />
                <span>
                  {(profile?.overallRating ?? 0).toFixed(1)} rating from{' '}
                  {profile?.totalReviews ?? 0} reviews
                </span>
              </div>
            </div>
            {profile?.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={16} />
                <span>Lives in {profile.location}</span>
              </div>
            )}
            {(profile?.languages?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Languages size={16} />
                <span>Speaks {(profile?.languages ?? []).join(', ')}</span>
              </div>
            )}
            {profile?.joinDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} />
                <span>
                  Joined in{' '}
                  {new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(profile.joinDate)}
                </span>
              </div>
            )}
          </div>
        </div>
        <Divider />

        {/* Children Section */}
        <div>
          <h4 className="text-lg font-semibold mb-3">Children details</h4>
          <Accordion selectionMode="multiple" className="px-0 space-y-4">
            {children.map(child => (
              <AccordionItem
                key={child.id}
                title={<span className="text-[16px] font-semibold">{child.name}</span>}
                classNames={{
                  base: 'bg-transparent',
                  title: 'text-sm font-medium',
                  subtitle: 'text-secondary',
                  trigger: 'py-0 cursor-pointer',
                  content: 'pt-3',
                }}
                indicator={<ChevronLeft size={20} className="text-secondary" />}
              >
                <div className="bg-white dark:bg-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-600">
                  <div className="py-2">
                    <div className="text-sm font-medium">Relationship</div>
                    <div className="text-sm text-secondary mt-1">Legal guardian, Father</div>
                  </div>
                  <div className="py-2">
                    <div className="text-sm font-medium">Profile</div>
                    <div className="text-sm text-secondary mt-1">
                      {child.personalInfo.gender || 'Not specified'},{' '}
                      {child.personalInfo.dateOfBirth
                        ? `${Math.floor(
                            (new Date().getTime() - child.personalInfo.dateOfBirth.getTime()) /
                              (365.25 * 24 * 60 * 60 * 1000)
                          )} years old`
                        : 'Age not specified'}
                    </div>
                  </div>
                  <div className="py-2">
                    <div className="text-sm font-medium">Nationality</div>
                    <div className="text-sm text-secondary mt-1">
                      {child.personalInfo.nationality || 'Not specified'}, Speaks{' '}
                      {child.personalInfo.languages.join(' and ') || 'Not specified'}
                    </div>
                  </div>
                  <div className="py-2">
                    <div className="text-sm font-medium">Current school</div>
                    <div className="text-sm text-secondary mt-1">
                      Name of the school, grade {child.academicPreferences.currentGrade || 'N/A'}
                    </div>
                  </div>
                  <div className="py-2">
                    <div className="text-sm font-medium">Interest</div>
                    <div className="text-sm text-secondary mt-1">
                      {child.extraCurricular.interests.length > 0
                        ? child.extraCurricular.interests.join(', ')
                        : 'Not specified'}
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="text-sm font-medium">Special needs</div>
                    <div className="text-sm text-secondary mt-1">
                      {child.specialNeeds.additionalNotes ||
                        (child.specialNeeds.areas.length === 0 &&
                        child.specialNeeds.supportNeeds.length === 0
                          ? 'None'
                          : [...child.specialNeeds.areas, ...child.specialNeeds.supportNeeds].join(
                              ', '
                            ))}
                    </div>
                  </div>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <Divider />

        {/* Reviews Section */}
        <div>
          <div className="p-0 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">{profile?.firstName}’s reviews</h4>
            </div>
            <div className="space-y-3">
              {/* ['Rating average', 'Communication', 'Child behavior', 'Reliability', 'Respect'] */}
              {['Rating average'].map(key => {
                const value = profile?.overallRating ?? 0
                const percent = Math.max(0, Math.min(100, (value / 5) * 100))
                return (
                  <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn('text-sm min-w-[120px]', {
                          'font-semibold': key === 'Rating average',
                        })}
                      >
                        {key}
                      </span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded">
                        <div
                          className="h-2 bg-gray-600 dark:bg-gray-300 rounded"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm tabular-nums">{value.toFixed(1)} ★</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Reviews List */}
          <div className="max-h-96 overflow-y-auto">
            <div className="text-xs">{profile?.totalReviews ?? 0} reviews</div>
            {displayedReviews.length > 0 ? (
              displayedReviews.map(review => (
                <React.Fragment key={review.id}>
                  <ReviewItem review={review} className="border-0" />
                  <Divider />
                </React.Fragment>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">No reviews yet</div>
            )}
          </div>

          {/* Show More Reviews Button */}
          {reviews.length > 3 && (
            <div className="p-0">
              <Button
                variant="light"
                onPress={() => setShowAllReviews(!showAllReviews)}
                className="w-full text-primary"
                startContent={showAllReviews ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              >
                {showAllReviews ? `Show Less Reviews` : `Show All ${reviews.length} Reviews`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Export with both names for backward compatibility
export const UserPreferencesSidebar = UserProfileSidebar
