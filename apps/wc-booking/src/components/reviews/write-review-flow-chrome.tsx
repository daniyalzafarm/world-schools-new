'use client'

import React from 'react'
import { Button, Tooltip } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { ArrowLeft, X } from 'lucide-react'

export interface WriteReviewFlowHeaderCamp {
  name: string
  locationName?: string | null
  imageUrl?: string | null
}

export function WriteReviewFlowHeader({
  onBack,
  onClose,
  showBack = true,
  camp,
}: {
  onBack: () => void
  onClose: () => void
  showBack?: boolean
  camp?: WriteReviewFlowHeaderCamp | null
}) {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-default-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-5 py-3.5 md:gap-4 md:px-8 md:py-4">
        <Button
          isIconOnly
          variant="light"
          onPress={onBack}
          className={cn(
            'min-w-10 text-default-900 dark:text-white',
            !showBack && 'invisible pointer-events-none'
          )}
          aria-label="Back"
        >
          <ArrowLeft className="size-6 md:size-7" strokeWidth={2} />
        </Button>

        {camp ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-default-100 dark:bg-slate-800">
              {camp.imageUrl ? (
                <img src={camp.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <div className="flex size-full items-center justify-center text-base font-semibold text-default-400 dark:text-slate-500">
                  {camp.name[0]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-default-900 dark:text-white">
                {camp.name}
              </p>
              {camp.locationName ? (
                <p className="truncate text-xs text-default-500 dark:text-slate-400">
                  {camp.locationName}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        <Button
          isIconOnly
          variant="flat"
          onPress={onClose}
          className="size-8 min-w-8 shrink-0 rounded-full bg-default-100 text-default-500 hover:bg-default-200 hover:text-default-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>
    </header>
  )
}

export function WriteReviewFlowProgress({ progressPct }: { progressPct: number }) {
  return (
    <div
      className="h-1 shrink-0 bg-default-100 dark:bg-slate-800"
      role="progressbar"
      aria-valuenow={Math.round(progressPct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary-700 transition-all duration-300 ease-out dark:bg-primary-600"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  )
}

export function WriteReviewFlowFooter({
  showBack,
  onBack,
  showNext,
  nextLabel,
  nextDisabled,
  nextDisabledReason,
  onNext,
}: {
  showBack: boolean
  onBack: () => void
  showNext: boolean
  nextLabel: string
  nextDisabled: boolean
  nextDisabledReason?: string
  onNext: () => void
}) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-default-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3.5 md:max-w-2xl md:px-8 md:py-4">
        <Button
          variant="light"
          onPress={onBack}
          className={cn(!showBack && 'invisible pointer-events-none')}
        >
          Back
        </Button>
        {showNext ? (
          <Tooltip
            content={nextDisabledReason ?? ''}
            isDisabled={!nextDisabled || !nextDisabledReason}
            placement="top"
            closeDelay={0}
          >
            <span>
              <Button onPress={onNext} isDisabled={nextDisabled} color="secondary">
                {nextLabel}
              </Button>
            </span>
          </Tooltip>
        ) : (
          <span className="min-w-28" aria-hidden />
        )}
      </div>
    </footer>
  )
}

export function WriteReviewStepContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-5 pb-32 pt-9 md:max-w-2xl md:px-8 md:pb-32 md:pt-12">
      {children}
    </div>
  )
}
