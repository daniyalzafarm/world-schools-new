'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { addToast, Button } from '@heroui/react'
import { CheckCircle2, Eye, LogOut, Pencil } from 'lucide-react'
import { useCampsStore } from '@/stores/camps-store'
import { useSessionsStore } from '@/stores/sessions-store'
import * as campsService from '@/services/camps.services'
import { getCampEligibility } from '@/services/camps.services'
import { getCampAddOns } from '@/services/camp-addons.service'
import config from '@/config/config'
import {
  editorSections,
  getSectionProgress,
  getStatus,
  shouldShowSection,
} from '@/components/camps/editor-sections'
import { CountBadge } from '@/components/camps/CountBadge'
import { Can } from '@/components/auth/can'

const RING_SIZE = 160
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function ProgressRing({ percent }: { percent: number }) {
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
          className="fill-none stroke-default-200"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="fill-none stroke-primary-600 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-primary-600">{percent}%</span>
        <span className="text-xs font-medium uppercase tracking-wide text-default-500">
          complete
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | undefined }) {
  const map: Record<string, { label: string; classes: string }> = {
    draft: { label: 'Draft', classes: 'bg-warning-100 text-warning-800' },
    published: { label: 'Published', classes: 'bg-success-100 text-success-700' },
    archived: { label: 'Archived', classes: 'bg-default-200 text-default-600' },
  }
  const meta = map[status ?? 'draft'] ?? map.draft
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.classes}`}
    >
      {meta.label}
    </span>
  )
}

function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-default-200 bg-white p-8">
      <div className="grid items-center gap-8 md:grid-cols-[160px_1fr]">
        <div className="h-40 w-40 animate-pulse rounded-full bg-default-100" />
        <div className="space-y-3">
          <div className="h-5 w-24 animate-pulse rounded-full bg-default-100" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-default-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-default-100" />
        </div>
      </div>
    </div>
  )
}

function SectionsListSkeleton() {
  return (
    <div className="mt-10 space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="overflow-hidden rounded-2xl border border-default-200">
          <div className="border-b border-default-100 bg-default-50 px-6 py-3">
            <div className="h-3 w-32 animate-pulse rounded bg-default-200" />
          </div>
          <div className="divide-y divide-default-100">
            {[1, 2, 3].map(j => (
              <div key={j} className="flex items-center gap-4 px-6 py-3.5">
                <div className="h-4 flex-1 animate-pulse rounded bg-default-100" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-default-100" />
                <div className="h-7 w-16 animate-pulse rounded-lg bg-default-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function waitForPendingSave(): Promise<void> {
  return new Promise(resolve => {
    if (!useCampsStore.getState().hasPendingAutoSave) {
      resolve()
      return
    }
    const interval = setInterval(() => {
      if (!useCampsStore.getState().hasPendingAutoSave) {
        clearInterval(interval)
        resolve()
      }
    }, 100)
    setTimeout(() => {
      clearInterval(interval)
      resolve()
    }, 10000)
  })
}

export default function ReviewPublishPage() {
  const params = useParams()
  const router = useRouter()
  const campId = params.campId as string

  const {
    currentCamp,
    publishCamp,
    hasUnsavedChanges,
    sidebarEligibilityCount,
    sidebarAddonEnabledCount,
    sidebarAddonTotalCount,
  } = useCampsStore()

  const sessions = useSessionsStore(state => state.sessions)
  const sessionsCampId = useSessionsStore(state => state.currentCampId)
  const loadSessions = useSessionsStore(state => state.loadSessions)

  const [isPublishing, setIsPublishing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (sessionsCampId !== campId) {
      void loadSessions(campId)
    }
  }, [campId, sessionsCampId, loadSessions])

  useEffect(() => {
    if (sidebarEligibilityCount === null) {
      getCampEligibility(campId)
        .then(res => {
          const count = res.success ? (res.data.items?.length ?? 0) : 0
          useCampsStore.setState({ sidebarEligibilityCount: count })
        })
        .catch(() => {
          useCampsStore.setState({ sidebarEligibilityCount: 0 })
        })
    }
    if (sidebarAddonTotalCount === null) {
      getCampAddOns(campId)
        .then(res => {
          if (res.success) {
            const addOns = res.data.addOns
            useCampsStore.setState({
              sidebarAddonEnabledCount: addOns.filter(a => a.isEnabled).length,
              sidebarAddonTotalCount: addOns.length,
            })
          } else {
            useCampsStore.setState({
              sidebarAddonEnabledCount: 0,
              sidebarAddonTotalCount: 0,
            })
          }
        })
        .catch(() => {
          useCampsStore.setState({
            sidebarAddonEnabledCount: 0,
            sidebarAddonTotalCount: 0,
          })
        })
    }
  }, [campId, sidebarEligibilityCount, sidebarAddonTotalCount])

  const sessionCounts =
    sessionsCampId === campId
      ? {
          published: sessions.filter(s => s.status === 'published').length,
          total: sessions.length,
        }
      : null

  const { rows, percent, sectionsDone, totalSections } = useMemo(() => {
    const visible = editorSections
      .filter(s => shouldShowSection(s, currentCamp))
      .filter(s => !s.excludeFromProgress)
    const rs = visible.map(s => ({
      section: s,
      progress: getSectionProgress(
        s.id,
        currentCamp,
        sidebarEligibilityCount,
        sidebarAddonEnabledCount,
        sidebarAddonTotalCount,
        sessionCounts
      ),
    }))
    const totals = rs.reduce(
      (a, r) => ({ c: a.c + r.progress.completed, t: a.t + r.progress.total }),
      { c: 0, t: 0 }
    )
    const pct = totals.t > 0 ? Math.round((totals.c / totals.t) * 100) : 0
    const done = rs.filter(r => getStatus(r.progress) === 'complete').length
    return { rows: rs, percent: pct, sectionsDone: done, totalSections: visible.length }
  }, [
    currentCamp,
    sidebarEligibilityCount,
    sidebarAddonEnabledCount,
    sidebarAddonTotalCount,
    sessionCounts,
  ])

  const categories = useMemo(
    () => Array.from(new Set(rows.map(r => r.section.category).filter((c): c is string => !!c))),
    [rows]
  )

  const status = currentCamp?.status
  const isPublished = status === 'published'
  const isArchived = status === 'archived'
  const canPublish = !isPublished && !isArchived

  const handlePublish = async () => {
    if (!campId) return
    setIsPublishing(true)
    await publishCamp(campId)
    setIsPublishing(false)
    if (useCampsStore.getState().error) return
    addToast({
      title: 'Success',
      description: 'Camp published successfully!',
      color: 'success',
    })
    router.push('/camps')
  }

  const handlePreview = async () => {
    if (!campId || !currentCamp?.slug) return
    setIsPreviewing(true)
    const response = await campsService.generatePreviewToken(campId)
    setIsPreviewing(false)
    if (!response.success) {
      addToast({
        title: 'Error',
        description: response.data.message || 'Failed to open camp preview. Please try again.',
        color: 'danger',
      })
      return
    }
    const campUrl = `${config.app.bookingAppUrl}/camps/${currentCamp.slug}?preview=${response.data.token}`
    window.open(campUrl, '_blank')
  }

  const handleExit = async () => {
    setIsExiting(true)
    const flush = useCampsStore.getState().autoSaveFlush
    try {
      if (flush) await flush()
      await waitForPendingSave()
    } finally {
      setIsExiting(false)
    }
    router.push('/camps')
  }

  const heroSubtext = isPublished
    ? `Your camp is live. ${sectionsDone} of ${totalSections} sections complete · ${percent}% overall`
    : isArchived
      ? 'This camp is archived and is not visible to families.'
      : percent === 100
        ? `All ${totalSections} sections complete · ready to publish`
        : `${sectionsDone} of ${totalSections} sections complete · ${percent}% overall`

  if (!currentCamp) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Review & Publish</h1>
          <p className="text-base leading-normal text-default-500">
            Final check before your camp goes live
          </p>
        </div>
        <HeroSkeleton />
        <SectionsListSkeleton />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-1.5 text-2xl font-semibold text-foreground">Review & Publish</h1>
        <p className="text-base leading-normal text-default-500">
          Final check before your camp goes live
        </p>
      </div>

      <div className="rounded-2xl border border-default-200 bg-white p-8">
        <div className="grid items-center gap-8 md:grid-cols-[160px_1fr]">
          <div className="flex justify-center md:justify-start">
            <ProgressRing percent={percent} />
          </div>
          <div className="flex flex-col gap-3">
            <StatusBadge status={status} />
            <h2 className="text-2xl font-semibold text-foreground">
              {currentCamp.name || 'Untitled Camp'}
            </h2>
            <p className="flex items-center gap-2 text-base leading-normal text-default-500">
              {percent === 100 && !isArchived && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
              )}
              <span>{heroSubtext}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-default-100 pt-6">
          <Button
            color="danger"
            variant="flat"
            onPress={handleExit}
            isLoading={isExiting}
            isDisabled={isExiting}
            startContent={!isExiting && <LogOut className="h-4 w-4" />}
            size="lg"
          >
            Exit
          </Button>
          <Button
            variant="bordered"
            onPress={handlePreview}
            isLoading={isPreviewing}
            isDisabled={!campId || isPreviewing || !currentCamp.slug}
            startContent={!isPreviewing && <Eye className="h-4 w-4" />}
            size="lg"
          >
            Secure Preview
          </Button>
          {isPublished && (
            <Button
              as="a"
              href={`${config.app.bookingAppUrl}/camps/${currentCamp.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              startContent={<Eye className="h-4 w-4" />}
              size="lg"
            >
              View Live Camp
            </Button>
          )}
          {canPublish && (
            <Can permission="camps.publish">
              <Button
                color="primary"
                onPress={handlePublish}
                isLoading={isPublishing}
                isDisabled={isPublishing || hasUnsavedChanges}
              >
                Publish
              </Button>
            </Can>
          )}
          {isArchived && (
            <Button color="default" variant="bordered" isDisabled>
              Restore (contact support)
            </Button>
          )}
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {categories.map(category => {
          const categoryRows = rows.filter(r => r.section.category === category)
          if (categoryRows.length === 0) return null
          return (
            <div
              key={category}
              className="overflow-hidden rounded-2xl border border-default-200 bg-white"
            >
              <div className="border-b border-default-100 bg-default-50 px-6 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.5px] text-default-500">
                  {category}
                </p>
              </div>
              <ul className="divide-y divide-default-100">
                {categoryRows.map(({ section, progress }) => (
                  <li key={section.id} className="flex items-center gap-4 px-6 py-3.5">
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {section.label}
                    </span>
                    <CountBadge progress={progress} />
                    <Button
                      as={Link}
                      href={`/camps/${campId}/edit/${section.path}`}
                      color="primary"
                      variant="flat"
                      size="sm"
                      startContent={<Pencil className="h-3.5 w-3.5" />}
                      aria-label={`Edit ${section.label}`}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
