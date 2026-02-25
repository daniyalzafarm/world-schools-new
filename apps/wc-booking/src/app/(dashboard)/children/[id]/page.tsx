'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Alert, Button, Chip, cn, Progress, Spinner } from '@heroui/react'
import { Activity, Camera, ChevronRight, Phone, Star, User } from 'lucide-react'
import { type Child, getChildDisplayName } from '@/types/child'
import { useChildrenStore } from '@/stores/children-store'

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth: Date | string | undefined): number | null {
  if (!dateOfBirth) return null
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}

// Helper function to format date
function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Mock stats (these would come from actual data in production)
function getMockStats(_child: Child) {
  return {
    camps: Math.floor(Math.random() * 10),
    certificates: Math.floor(Math.random() * 8),
    upcoming: Math.floor(Math.random() * 3),
  }
}

// Get profile completion from backend (child.profileCompletion)
// No need to calculate manually - backend handles this
function getProfileCompletion(child: Child): number {
  return child.profileCompletion || 0
}

export default function ChildDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const childId = params.id as string
  const { children, isLoading, fetchChildren, getChildById } = useChildrenStore()

  // Fetch children data if store is empty (e.g., after page reload)
  useEffect(() => {
    if (children.length === 0 && !isLoading && childId !== 'new') {
      fetchChildren().catch(error => {
        console.error('Failed to fetch children:', error)
      })
    }
  }, [children.length, isLoading, childId, fetchChildren])

  // Show loading spinner while fetching data for existing child
  if (childId !== 'new' && children.length === 0 && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Loading child data..." />
      </div>
    )
  }

  // Show loading spinner if we're editing but child not found yet and still loading
  if (childId !== 'new' && !getChildById(childId) && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" label="Loading child data..." />
      </div>
    )
  }

  const child = getChildById(childId)

  // If child not found, show error
  if (!child && childId !== 'new') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Child not found</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          The child you're looking for doesn't exist.
        </p>
        <Button color="primary" onPress={() => router.push('/children')}>
          Back to Children
        </Button>
      </div>
    )
  }

  // If new child, redirect to children list (modal will handle creation)
  if (childId === 'new' || !child) {
    router.push('/children')
    return null
  }

  const age = calculateAge(child.dateOfBirth)
  const initial = child.firstName.charAt(0).toUpperCase()
  const stats = getMockStats(child)
  const profileCompletion = getProfileCompletion(child)

  // Check for missing/incomplete data
  const hasEmergencyContacts = child.emergencyContacts.length > 0
  const hasMedicalInfo = child.medicalInfo !== null
  const isProfileComplete = profileCompletion >= 75

  return (
    <div>
      {/* Page Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
          {child.firstName}'s Profile
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400">
          Manage {child.firstName}'s information and preferences
        </p>
      </header>

      {/* Profile Completion Alerts */}
      {!isProfileComplete && (
        <Alert color="warning" className="mb-6">
          <div className="font-semibold">Complete your profile to enable booking</div>
          <div className="text-sm mt-1">
            Your profile is {profileCompletion}% complete. Complete at least 75% to book camps.
          </div>
        </Alert>
      )}

      {!hasEmergencyContacts && (
        <Alert color="danger" className="mb-6">
          <div className="font-semibold">Emergency contact required</div>
          <div className="text-sm mt-1">
            Please add at least one emergency contact before booking camps.{' '}
            <button
              onClick={() => router.push(`/children/${childId}/emergency`)}
              className={cn('cursor-pointer font-semibold underline hover:text-error-500')}
            >
              Add emergency contact
            </button>
          </div>
        </Alert>
      )}

      {!hasMedicalInfo && (
        <Alert color="warning" className="mb-6">
          <div className="font-semibold">Medical information recommended</div>
          <div className="text-sm mt-1">
            Adding medical information helps camps better prepare for {child.firstName}'s needs.{' '}
            <button
              onClick={() => router.push(`/children/${childId}/medical`)}
              className={cn('cursor-pointer font-semibold underline hover:text-warning-500')}
            >
              Add medical information
            </button>
          </div>
        </Alert>
      )}

      {/* Profile Card */}
      <div className="flex items-center gap-6 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mb-8">
        <div className="relative">
          {child.photoUrl ? (
            <img
              src={child.photoUrl}
              alt={child.firstName}
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-teal-50 dark:from-blue-900 dark:to-teal-900 flex items-center justify-center text-3xl font-semibold text-slate-900 dark:text-white shrink-0 border-2 border-slate-200 dark:border-slate-700">
              {initial}
            </div>
          )}
          <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Camera size={14} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
            {getChildDisplayName(child)}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            {age !== null && `${age} years old`}
            {age !== null && child.dateOfBirth && ' • '}
            {child.dateOfBirth && `Born ${formatDate(child.dateOfBirth)}`}
          </p>
          <div className="flex gap-6">
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.camps}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Camps</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {stats.certificates}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Certificates</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {stats.upcoming}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Upcoming</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion */}
      <div
        className={`rounded-xl p-5 mb-8 ${
          profileCompletion >= 75
            ? 'bg-success-50 dark:bg-success-900/20'
            : 'bg-warning-50 dark:bg-warning-900/20'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-sm font-semibold ${
              profileCompletion >= 75
                ? 'text-success-700 dark:text-success-300'
                : 'text-warning-700 dark:text-warning-300'
            }`}
          >
            Profile completeness
          </span>
          <span
            className={`text-sm font-bold ${
              profileCompletion >= 75
                ? 'text-success-700 dark:text-success-300'
                : 'text-warning-700 dark:text-warning-300'
            }`}
          >
            {profileCompletion}%
          </span>
        </div>
        <Progress
          value={profileCompletion}
          color={profileCompletion >= 75 ? 'success' : 'warning'}
          className="mb-3"
        />
        <p
          className={`text-xs ${
            profileCompletion >= 75
              ? 'text-success-700 dark:text-success-300'
              : 'text-warning-700 dark:text-warning-300'
          }`}
        >
          {profileCompletion < 100 ? (
            <>
              <button
                onClick={() => router.push(`/children/${childId}/profile`)}
                className={cn(
                  'cursor-pointer font-semibold underline',
                  profileCompletion >= 75 ? 'hover:text-success-500' : 'hover:text-warning-500'
                )}
              >
                Complete the profile
              </button>{' '}
              to help camps better prepare for {child.firstName}'s needs
            </>
          ) : (
            `${child.firstName}'s profile is complete!`
          )}
        </p>
      </div>

      {/* Quick Access */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          Quick access
        </h2>
        <div className="space-y-1">
          {/* Personal information */}
          <button
            onClick={() => router.push(`/children/${childId}/profile`)}
            className="cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <User size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                Personal information
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Name, birthday, school year
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </button>

          {/* Medical information */}
          <button
            onClick={() => router.push(`/children/${childId}/medical`)}
            className="cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-900 dark:text-white">
              <Activity size={20} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                Medical information
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Allergies, medications, special needs
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </button>

          {/* Emergency contacts */}
          <button
            onClick={() => router.push(`/children/${childId}/emergency`)}
            className="cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasEmergencyContacts
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'bg-danger-100 dark:bg-danger-900/30'
              }`}
            >
              <Phone
                size={20}
                className={hasEmergencyContacts ? '' : 'text-danger-600 dark:text-danger-400'}
              />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                Emergency contacts
              </div>
              <div
                className={`text-sm ${
                  hasEmergencyContacts
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-danger-600 dark:text-danger-400 font-semibold'
                }`}
              >
                {hasEmergencyContacts
                  ? `${child.emergencyContacts.length} contact${child.emergencyContacts.length > 1 ? 's' : ''} added`
                  : 'At least 1 contact required'}
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </button>

          {/* Camp preferences */}
          <button
            onClick={() => router.push(`/children/${childId}/preferences`)}
            className="cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors w-full"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-900 dark:text-white">
              <Star size={20} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-base font-medium text-slate-900 dark:text-white mb-0.5">
                Camp preferences
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Location, budget, camp type
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 shrink-0" />
          </button>
        </div>
      </section>
    </div>
  )
}
