'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Checkbox } from '@heroui/react'
import { cn } from '@world-schools/ui-web'
import { ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { REVIEW_TAG_CONFIG } from '@world-schools/wc-types'
import { useReviewsStore } from '@/stores/reviews-store'
import { StarRatingInput } from '@/components/reviews/star-rating-input'
import type { CreateReviewPayload, ReviewTagDimension } from '@/types/reviews'
import eventBus from '@/utils/event-bus'

// ─── Form state shape ────────────────────────────────────────────────────────

interface FormData {
  visitMonth: number
  visitYear: number
  kidCount: number
  kidAges: number[]
  kidTags: string[]
  happinessRating: number
  happinessTags: string[]
  safetyRating: number
  safetyTags: string[]
  communicationRating: number
  communicationTags: string[]
  asDescribedRating: number
  growthRating: number
  valueRating: number
  returnChoice: boolean | null
  reviewText: string
  agreeDisclaimer: boolean
}

const PERSONALITY_TAGS = [
  'Shy/introverted',
  'Outgoing',
  'Adventurous',
  'Cautious',
  'First-time camper',
  'Sporty',
  'Creative',
]

const OUTCOME_OPTIONS = [
  'Gained confidence',
  'Made friends',
  'Tried new activities',
  'Improved a skill',
  'Loved it',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i)
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const AGES = Array.from({ length: 14 }, (_, i) => i + 4)

// ─── Reusable sub-components ─────────────────────────────────────────────────

const TagPill = ({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      'px-3.5 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer',
      selected
        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400'
    )}
  >
    {label}
  </button>
)

const SectionDivider = () => (
  <div className="border-t border-slate-100 dark:border-slate-800 my-6" />
)

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepKey =
  | 'visit'
  | 'happiness'
  | 'safety'
  | 'communication'
  | 'dims'
  | 'return'
  | 'story'
  | 'submit'
  | 'done'

// ─── Main page ────────────────────────────────────────────────────────────────

const WriteReviewPage = () => {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const campId = params.campId as string
  const bookingGroupId = searchParams.get('bookingGroupId') ?? undefined
  const bookingId = searchParams.get('bookingId') ?? undefined
  const reviewIdParam = searchParams.get('reviewId') ?? undefined

  const isVerified = !!bookingId
  const { allCamps, attended, addReview } = useReviewsStore()

  // Resolve camp info from store or attended list
  const camp = useMemo(() => {
    const fromAttended = attended.find(a => a.id === campId)
    if (fromAttended) return fromAttended
    return allCamps.find(c => c.id === campId)
  }, [campId, attended, allCamps])

  const campPhotos = camp?.photos as { url?: string; isPrimary?: boolean }[] | null
  const campImageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  // Step sequence
  const steps: StepKey[] = useMemo(() => {
    const base: StepKey[] = isVerified
      ? ['happiness', 'safety', 'communication', 'dims', 'return', 'story', 'submit', 'done']
      : [
          'visit',
          'happiness',
          'safety',
          'communication',
          'dims',
          'return',
          'story',
          'submit',
          'done',
        ]
    return base
  }, [isVerified])

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<FormData>({
    visitMonth: new Date().getMonth() + 1,
    visitYear: currentYear,
    kidCount: 1,
    kidAges: [8],
    kidTags: [],
    happinessRating: 0,
    happinessTags: [],
    safetyRating: 0,
    safetyTags: [],
    communicationRating: 0,
    communicationTags: [],
    asDescribedRating: 0,
    growthRating: 0,
    valueRating: 0,
    returnChoice: null,
    reviewText: '',
    agreeDisclaimer: false,
  })

  useEffect(() => {
    eventBus.$emit('sidebar:collapse')
  }, [])

  const currentStep = steps[currentStepIndex]
  const isDoneStep = currentStep === 'done'
  const isSubmitStep = currentStep === 'submit'

  // Progress: exclude 'done' from progress bar
  const progressSteps = steps.filter(s => s !== 'done')
  const progressIndex = progressSteps.indexOf(currentStep as any)
  const progressPct = progressIndex >= 0 ? ((progressIndex + 1) / progressSteps.length) * 100 : 100

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'happiness':
        return form.happinessRating > 0
      case 'safety':
        return form.safetyRating > 0
      case 'communication':
        return form.communicationRating > 0
      case 'return':
        return form.returnChoice !== null
      case 'submit':
        return form.agreeDisclaimer
      default:
        return true
    }
  }, [currentStep, form])

  const isSkippable = ['dims', 'story'].includes(currentStep)
  const hasInput = useMemo(() => {
    if (currentStep === 'dims') {
      return form.asDescribedRating > 0 || form.growthRating > 0 || form.valueRating > 0
    }
    if (currentStep === 'story') return form.reviewText.trim().length > 0
    return false
  }, [currentStep, form])

  const showNext = isSkippable ? hasInput : canProceed
  const nextLabel = isSubmitStep ? 'Publish Review' : isSkippable && !hasInput ? 'Skip' : 'Next'

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) setCurrentStepIndex(i => i + 1)
  }

  const goBack = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(i => i - 1)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const tags: CreateReviewPayload['tags'] = []

    for (const dim of ['happiness', 'safety', 'communication'] as ReviewTagDimension[]) {
      const dimTags = form[`${dim}Tags` as keyof FormData] as string[]
      for (const tagValue of dimTags) {
        tags.push({ dimension: dim, tagValue })
      }
    }

    const payload: CreateReviewPayload = {
      campId,
      bookingGroupId,
      bookingId,
      ...(isVerified
        ? {}
        : {
            visitMonth: form.visitMonth,
            visitYear: form.visitYear,
            kidCount: form.kidCount,
            kidAges: form.kidAges,
            kidTags: form.kidTags,
          }),
      happinessRating: form.happinessRating || undefined,
      safetyRating: form.safetyRating || undefined,
      communicationRating: form.communicationRating || undefined,
      asDescribedRating: form.asDescribedRating || undefined,
      growthRating: form.growthRating || undefined,
      valueRating: form.valueRating || undefined,
      tags,
      reviewText: form.reviewText.trim() || undefined,
      returnChoice: form.returnChoice ?? undefined,
      status: 'pending',
    }

    await addReview(payload)
    setIsSubmitting(false)
    goNext() // → done step
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const toggleTag = (
    field: 'happinessTags' | 'safetyTags' | 'communicationTags' | 'kidTags',
    value: string
  ) => {
    setForm(f => {
      const current = f[field] as string[]
      return {
        ...f,
        [field]: current.includes(value) ? current.filter(t => t !== value) : [...current, value],
      }
    })
  }

  // ─── Done screen ──────────────────────────────────────────────────────────
  if (isDoneStep) {
    return (
      <div className="absolute inset-0 bg-white dark:bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-18 h-18 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">
            Thanks for your review!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            Your review is now in moderation and will appear on the camp&apos;s profile within 24
            hours. It&apos;ll help other families make the right choice.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onPress={() => router.push('/reviews')}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl w-full"
            >
              Go to my reviews
            </Button>
            <Button variant="flat" onPress={() => router.back()} className="rounded-xl w-full">
              Done
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main form shell ──────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-white dark:bg-slate-900 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-slate-100 dark:bg-slate-800 shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Fixed header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <button
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0',
            currentStepIndex === 0
              ? 'opacity-0 pointer-events-none'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <ArrowLeft size={18} className="text-slate-600 dark:text-slate-400" />
        </button>

        {/* Camp context */}
        {camp && (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
              {campImageUrl ? (
                <img src={campImageUrl} alt={camp.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                  {camp.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {camp.name}
              </p>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 size={11} />
                  Verified
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/reviews')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <X size={18} className="text-slate-600 dark:text-slate-400" />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-6 py-8">
          {/* ── Step: Visit details ─────────────────────────────────────── */}
          {currentStep === 'visit' && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                About Your Kid&apos;s Visit
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                A few details to make your review more useful for families searching for camps.
              </p>

              {/* When */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                  When did you attend?
                </p>
                <div className="flex gap-3">
                  <select
                    value={form.visitMonth}
                    onChange={e => setField('visitMonth', Number(e.target.value))}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.visitYear}
                    onChange={e => setField('visitYear', Number(e.target.value))}
                    className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kid count */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                  How many kids attended?
                </p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      const n = Math.max(1, form.kidCount - 1)
                      setField('kidCount', n)
                      setField('kidAges', form.kidAges.slice(0, n))
                    }}
                    disabled={form.kidCount <= 1}
                    className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:border-slate-400 transition-colors"
                  >
                    −
                  </button>
                  <span className="text-lg font-semibold text-slate-900 dark:text-white w-6 text-center">
                    {form.kidCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const n = Math.min(4, form.kidCount + 1)
                      setField('kidCount', n)
                      setField('kidAges', [...form.kidAges, 8].slice(0, n))
                    }}
                    disabled={form.kidCount >= 4}
                    className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:border-slate-400 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Kid ages */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                  {form.kidCount === 1 ? 'Kid age' : 'Kid ages'}
                </p>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: form.kidCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {form.kidCount > 1 && (
                        <span className="text-sm text-slate-500 dark:text-slate-400 w-14">
                          Kid {i + 1}
                        </span>
                      )}
                      <select
                        value={form.kidAges[i] ?? 8}
                        onChange={e => {
                          const ages = [...form.kidAges]
                          ages[i] = Number(e.target.value)
                          setField('kidAges', ages)
                        }}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                      >
                        {AGES.map(a => (
                          <option key={a} value={a}>
                            {a} years old
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personality tags — hidden for multi-kid */}
              {form.kidCount === 1 && (
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                    About Your Kid <span className="text-slate-400 font-normal">(Optional)</span>
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    Helps families with similar kids find the best match.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PERSONALITY_TAGS.map(tag => (
                      <TagPill
                        key={tag}
                        label={tag}
                        selected={form.kidTags.includes(tag)}
                        onToggle={() => toggleTag('kidTags', tag)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step: Rating dimensions (happiness/safety/communication) ── */}
          {(['happiness', 'safety', 'communication'] as const).includes(
            currentStep as 'happiness' | 'safety' | 'communication'
          ) && (
            <div>
              {(() => {
                const dim = currentStep as 'happiness' | 'safety' | 'communication'
                const config = REVIEW_TAG_CONFIG[dim]
                const ratingField = `${dim}Rating` as keyof FormData
                const tagsField = `${dim}Tags` as
                  | 'happinessTags'
                  | 'safetyTags'
                  | 'communicationTags'
                const questions: Record<string, { q: string; sub: string }> = {
                  happiness: {
                    q: "How was your kid's overall experience?",
                    sub: 'The most direct measure of whether this camp is right for a family.',
                  },
                  safety: {
                    q: 'Did you feel your kid was safe?',
                    sub: 'Safety is the #1 concern for parents. Your rating here helps other families make confident decisions.',
                  },
                  communication: {
                    q: 'How well did the camp keep you informed?',
                    sub: "Parents' biggest anxiety is not knowing what's happening. Communication is the #1 anxiety reducer.",
                  },
                }
                const { q, sub } = questions[dim]

                return (
                  <>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                      {q}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">{sub}</p>

                    <div className="flex justify-center mb-6">
                      <StarRatingInput
                        value={form[ratingField] as number}
                        onChange={v => setField(ratingField, v)}
                        size="lg"
                      />
                    </div>

                    <SectionDivider />

                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                      What stood out? <span className="text-slate-400 font-normal">(Optional)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {config.tags.map(tag => (
                        <TagPill
                          key={tag.value}
                          label={tag.title}
                          selected={(form[tagsField] as string[]).includes(tag.value)}
                          onToggle={() => toggleTag(tagsField, tag.value)}
                        />
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* ── Step: Extra dimensions ────────────────────────────────── */}
          {currentStep === 'dims' && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                A few more ratings
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                Optional — these help parents find the right camp for their kid.
              </p>

              {[
                {
                  label: 'As described',
                  desc: 'Did the camp match what was promised on the listing?',
                  field: 'asDescribedRating' as const,
                },
                {
                  label: 'Growth & learning',
                  desc: 'Did your kid develop skills or grow personally?',
                  field: 'growthRating' as const,
                },
                {
                  label: 'Value for money',
                  desc: 'Was it worth what you paid?',
                  field: 'valueRating' as const,
                },
              ].map(({ label, desc, field }) => (
                <div key={field} className="mb-6">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                    <StarRatingInput
                      value={form[field]}
                      onChange={v => setField(field, v)}
                      size="sm"
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Step: Return choice ───────────────────────────────────── */}
          {currentStep === 'return' && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8">
                Would you book this camp again?
              </h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Yes', value: true },
                  { label: 'Probably not', value: false },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setField('returnChoice', value)}
                    className={cn(
                      'w-full py-4 px-6 rounded-2xl border-2 text-left font-medium text-base transition-all cursor-pointer',
                      form.returnChoice === value
                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Written review ──────────────────────────────────── */}
          {currentStep === 'story' && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                Anything you&apos;d like to share?
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Your words help other families find the right camp. No pressure — skip if you
                prefer.
              </p>
              <div className="relative">
                <textarea
                  value={form.reviewText}
                  onChange={e => setField('reviewText', e.target.value.slice(0, 800))}
                  rows={6}
                  placeholder="e.g. We chose this camp for the small group sizes. Communication was excellent — daily photo updates really reassured us as first-time camp parents."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <p className="absolute bottom-3 right-3 text-xs text-slate-400">
                  {form.reviewText.length}/800
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Submit ──────────────────────────────────────────── */}
          {currentStep === 'submit' && (
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                Submit your review
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Take a moment to review before publishing. Your review will appear publicly after a
                short moderation check.
              </p>

              {/* Summary card */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                    {campImageUrl ? (
                      <img
                        src={campImageUrl}
                        alt={camp?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                        {camp?.name[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {camp?.name}
                    </p>
                    {camp?.locationName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {camp.locationName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating summary */}
                <div className="space-y-2">
                  {[
                    { label: "Kid's Experience", val: form.happinessRating },
                    { label: 'Safety', val: form.safetyRating },
                    { label: 'Communication', val: form.communicationRating },
                    ...(form.asDescribedRating > 0
                      ? [{ label: 'As described', val: form.asDescribedRating }]
                      : []),
                    ...(form.growthRating > 0
                      ? [{ label: 'Growth & learning', val: form.growthRating }]
                      : []),
                    ...(form.valueRating > 0
                      ? [{ label: 'Value for money', val: form.valueRating }]
                      : []),
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <div
                            key={s}
                            className={cn(
                              'w-3 h-3 rounded-full',
                              s <= val ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'
                            )}
                          />
                        ))}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-1">
                          {val}/5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Review text preview */}
                {form.reviewText && (
                  <>
                    <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-4">
                        {form.reviewText}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Disclaimer */}
              <Checkbox
                isSelected={form.agreeDisclaimer}
                onValueChange={v => setField('agreeDisclaimer', v)}
                classNames={{
                  label: 'text-xs text-slate-600 dark:text-slate-400 leading-relaxed',
                }}
              >
                I certify that this review is based on my own genuine experience and that I have no
                personal or business relationship with this camp that would bias my review.
              </Checkbox>
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer */}
      {!isDoneStep && (
        <footer className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4 shrink-0 bg-white dark:bg-slate-900">
          <Button
            variant="flat"
            onPress={goBack}
            className="rounded-xl"
            isDisabled={currentStepIndex === 0}
          >
            Back
          </Button>

          <Button
            onPress={isSubmitStep ? handleSubmit : goNext}
            isDisabled={!canProceed && !isSkippable}
            isLoading={isSubmitting}
            className={cn(
              'rounded-xl font-semibold min-w-24',
              canProceed || (isSkippable && !hasInput)
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
            )}
          >
            {nextLabel}
          </Button>
        </footer>
      )}
    </div>
  )
}

export default WriteReviewPage
