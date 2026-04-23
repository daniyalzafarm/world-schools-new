'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import { Button, Chip } from '@heroui/react'
import { useChildDetailContext } from './ChildDetailContext'

/**
 * ChildDetailFooter Component
 * Footer for child detail pages (profile, medical, preferences)
 * Positioned at the layout level as a sticky footer
 * Shows form action buttons based on the current page
 */
export function ChildDetailFooter() {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const childId = params.id as string
  const { formState } = useChildDetailContext()

  // Determine which page we're on
  const isProfilePage = pathname.includes('/profile')
  const isMedicalPage = pathname.includes('/medical')
  const isPreferencesPage = pathname.includes('/preferences')

  // Only show footer on pages with forms
  const shouldShowFooter = isProfilePage || isMedicalPage || isPreferencesPage

  if (!shouldShowFooter) {
    return null
  }

  return (
    <div className="border-t border-default-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
        {isProfilePage && (
          <ProfileFooterContent childId={childId} router={router} formState={formState} />
        )}
        {isMedicalPage && (
          <MedicalFooterContent childId={childId} router={router} formState={formState} />
        )}
        {isPreferencesPage && (
          <PreferencesFooterContent childId={childId} router={router} formState={formState} />
        )}
      </div>
    </div>
  )
}

// Profile page footer content
function ProfileFooterContent({
  childId,
  router,
  formState,
}: {
  childId: string
  router: any
  formState: any
}) {
  const { isModified, isSaving } = formState

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isModified && (
          <Chip color="warning" variant="flat" size="sm">
            Unsaved changes
          </Chip>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="light"
          onPress={() => router.push(`/account/children/${childId}`)}
          isDisabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="profile-form"
          color="secondary"
          isLoading={isSaving}
          isDisabled={!isModified}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

// Medical page footer content
function MedicalFooterContent({
  childId,
  router,
  formState,
}: {
  childId: string
  router: any
  formState: any
}) {
  const { isModified, isSaving } = formState

  return (
    <div className="flex items-center justify-end">
      <Button
        type="submit"
        form="medical-form"
        color="primary"
        isLoading={isSaving}
        isDisabled={!isModified}
        className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  )
}

// Preferences page footer content
function PreferencesFooterContent({
  childId,
  router,
  formState,
}: {
  childId: string
  router: any
  formState: any
}) {
  const { isModified, isSaving } = formState

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isModified && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
            Unsaved changes
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="light"
          onPress={() => router.push(`/account/children/${childId}`)}
          isDisabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="preferences-form"
          color="secondary"
          isLoading={isSaving}
          isDisabled={!isModified}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
