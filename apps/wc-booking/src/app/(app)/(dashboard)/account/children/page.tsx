'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Chip, Spinner } from '@heroui/react'
import { AlertCircle, Info, Plus, X } from 'lucide-react'
import { BackButton } from '@world-schools/ui-web'
import { type Child, getChildAge, getChildDisplayName } from '@/types/child'
import { useChildrenStore } from '@/stores/children-store'
import { AddChildModal } from '@/components/modals/add-child-modal'

const INFO_BANNER_DISMISSED_KEY = 'wc_booking_children_info_banner_dismissed'

// Helper function to get avatar initial from child name
function getAvatarInitial(child: Child): string {
  return child.firstName.charAt(0).toUpperCase()
}

// Helper function to get gender-based gradient class
function getGenderGradientClass(gender: string | undefined): string {
  if (gender === 'boy') {
    return 'bg-gradient-to-br from-blue-100 to-teal-50'
  } else if (gender === 'girl') {
    return 'bg-gradient-to-br from-pink-100 to-yellow-50'
  }
  return 'bg-gradient-to-br from-rose-100 to-teal-50'
}

// Helper function to extract tags from child data
function getChildTags(child: Child): Array<{ label: string; isMedical: boolean }> {
  const tags: Array<{ label: string; isMedical: boolean }> = []

  // Medical info - allergies
  if (child.medicalInfo?.allergies && child.medicalInfo.allergies.length > 0) {
    child.medicalInfo.allergies.slice(0, 2).forEach(allergy => {
      tags.push({ label: allergy, isMedical: true })
    })
  }

  // Medical info - dietary requirements
  if (child.medicalInfo?.dietaryRequirements && child.medicalInfo.dietaryRequirements.length > 0) {
    child.medicalInfo.dietaryRequirements.slice(0, 2).forEach(diet => {
      tags.push({ label: diet, isMedical: true })
    })
  }

  // Swimming ability
  if (child.medicalInfo?.swimmingAbility) {
    const swimmingLabels: Record<string, string> = {
      cannot_swim: 'Cannot swim',
      beginner: 'Beginner swimmer',
      intermediate: 'Intermediate swimmer',
      advanced: 'Advanced swimmer',
      competitive: 'Competitive swimmer',
    }
    tags.push({ label: swimmingLabels[child.medicalInfo.swimmingAbility], isMedical: false })
  }

  // Limit to 3 tags max
  return tags.slice(0, 3)
}

// Mock stats (these would come from actual data in production)
function getMockStats(_child: Child) {
  // In production, these would be fetched from the backend based on child ID
  return {
    camps: Math.floor(Math.random() * 5),
    wishlists: Math.floor(Math.random() * 4),
    upcoming: Math.floor(Math.random() * 2),
  }
}

export default function ChildrenPage() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showInfoBanner, setShowInfoBanner] = useState(false)

  // Get children from store
  const { children, isLoading, error, fetchChildren, clearError } = useChildrenStore()

  // Fetch children on mount
  useEffect(() => {
    fetchChildren().catch(error => {
      console.error('Failed to fetch children:', error)
    })
  }, [])

  // Default to hidden so SSR/first paint never flashes a dismissed banner.
  useEffect(() => {
    if (localStorage.getItem(INFO_BANNER_DISMISSED_KEY) !== 'true') {
      setShowInfoBanner(true)
    }
  }, [])

  const handleAddChild = () => {
    setIsModalOpen(true)
  }

  const handleEditChild = (childId: string) => {
    router.push(`/account/children/${childId}`)
  }

  const handleDismissInfoBanner = () => {
    setShowInfoBanner(false)
    localStorage.setItem(INFO_BANNER_DISMISSED_KEY, 'true')
  }

  const infoBanner = showInfoBanner && (
    <div className="flex gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl mt-10">
      <Info className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        Child profiles help camps prepare for your child's needs and personalize recommendations.
        Information like allergies and dietary requirements are shared with camps when you book.
      </p>
      <Button
        isIconOnly
        onPress={handleDismissInfoBanner}
        aria-label="Dismiss"
        size="sm"
        variant="flat"
        radius="full"
        color="primary"
      >
        <X className="w-4 h-4 text-primary-600 dark:text-primary-400" />
      </Button>
    </div>
  )

  return (
    <>
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <BackButton href="/account" />
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">My Children</h1>
        </div>
        <p className="text-base text-slate-500 dark:text-slate-400">
          Manage profiles for your children to make booking easier and more personalized.
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" label="Loading children..." />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">
                Error Loading Children
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => {
                clearError()
                fetchChildren(true).catch(error => {
                  console.error('Failed to fetch children:', error)
                })
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Children Grid */}
      {!isLoading && !error && children.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            {children.map(child => {
              const age = getChildAge(child)
              const initial = getAvatarInitial(child)
              const gradientClass = getGenderGradientClass(child.gender)
              const tags = getChildTags(child)
              const stats = getMockStats(child)
              const isIncomplete = child.profileCompletion < 75

              return (
                <div
                  key={child.id}
                  onClick={() => handleEditChild(child.id)}
                  className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Warning Banner for Incomplete Profiles */}
                  {isIncomplete && (
                    <Alert color="warning" className="mb-4">
                      <div className="text-sm mt-1">
                        Profile {child.profileCompletion}% complete. Complete to 75% to enable
                        booking.
                      </div>
                    </Alert>
                  )}

                  {/* Header with Avatar and Info */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`w-16 h-16 rounded-full ${gradientClass} flex items-center justify-center text-2xl font-semibold text-slate-900 shrink-0`}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                          {getChildDisplayName(child)}
                        </div>
                        {/* Profile Completion Badge */}
                        <Chip
                          size="sm"
                          variant="flat"
                          className={
                            child.profileCompletion >= 75
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                          }
                        >
                          {child.profileCompletion}%
                        </Chip>
                      </div>
                      {age !== null && (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {age} years old
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tags.map((tag, index) => (
                        <Chip
                          key={index}
                          size="sm"
                          variant="flat"
                          className={
                            tag.isMedical
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }
                        >
                          {tag.label}
                        </Chip>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 mt-auto">
                    <div className="text-center flex-1">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {stats.camps}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Camps
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {stats.wishlists}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Wishlists
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {stats.upcoming}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Upcoming
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Add Child Button */}
            <button
              onClick={handleAddChild}
              className="flex items-center justify-center gap-2.5 w-full p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800 text-base font-semibold text-slate-500 dark:text-slate-400 cursor-pointer transition-all hover:border-slate-900 dark:hover:border-slate-300 hover:text-slate-900 dark:hover:text-white md:col-span-2"
            >
              <Plus className="w-6 h-6" />
              Add a child
            </button>
          </div>

          {infoBanner}
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && children.length === 0 && (
        <>
          {/* Add Child Button */}
          <button
            onClick={handleAddChild}
            className="flex items-center justify-center gap-2.5 w-full p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800 text-base font-semibold text-slate-500 dark:text-slate-400 cursor-pointer transition-all hover:border-slate-900 dark:hover:border-slate-300 hover:text-slate-900 dark:hover:text-white mb-6"
          >
            <Plus className="w-6 h-6" />
            Add a child
          </button>

          {infoBanner}
        </>
      )}

      {/* Add Child Modal */}
      <AddChildModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
