'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Checkbox, Divider, Tooltip } from '@heroui/react'
import { cn, SelectField, Textarea } from '@world-schools/ui-web'
import { Check, Minus, Plus, Star } from 'lucide-react'
import { REVIEW_TAG_CONFIG } from '@world-schools/wc-types'
import {
  WriteReviewFlowFooter,
  WriteReviewFlowHeader,
  WriteReviewFlowProgress,
  WriteReviewStepContent,
} from '@/components/reviews/write-review-flow-chrome'
import {
  WriteReviewFlowBigStars,
  WriteReviewFlowCompactStars,
} from '@/components/reviews/write-review-flow-stars'
import { reviewsService } from '@/services/reviews.services'
import { useReviewsStore } from '@/stores/reviews-store'
import {
  type CampReview,
  type CreateReviewPayload,
  normalizeCampReviewFromApi,
  type ReviewTagDimension,
} from '@/types/reviews'

type StepKey = 'visit' | 'happiness' | 'safety' | 'communication' | 'dims' | 'story' | 'submit'

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
  reviewText: string
  agreeDisclaimer: boolean
}

const PERSONALITY_TAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'shy_introverted', label: 'Shy / introverted' },
  { value: 'outgoing', label: 'Outgoing' },
  { value: 'adventurous', label: 'Adventurous' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'first_time_camper', label: 'First-time camper' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'creative', label: 'Creative' },
]

const currentYear = new Date().getFullYear()
const MIN_VISIT_YEAR = 2008
const VISIT_YEARS = Array.from(
  { length: currentYear - MIN_VISIT_YEAR + 1 },
  (_, i) => currentYear - i
)

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

const MONTH_EMPTY = '__month__'

const MONTH_SELECT_OPTIONS = [
  { value: MONTH_EMPTY, label: 'Month' },
  ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
]

const YEAR_SELECT_OPTIONS = VISIT_YEARS.map(y => ({ value: String(y), label: String(y) }))

const AGE_SELECT_OPTIONS = AGES.map(a => ({ value: String(a), label: `Age ${a}` }))

const visitSelectClassNames = {
  trigger: cn(
    'h-12 min-h-12 rounded-xl border-2 border-default-200 bg-white shadow-none',
    'data-[hover=true]:border-default-300 dark:border-slate-600 dark:bg-slate-900',
    'dark:data-[hover=true]:border-slate-500'
  ),
  value: 'text-sm text-default-900 dark:text-white',
  popoverContent: 'rounded-xl',
} as const

const REQUIRED_STEPS = new Set<StepKey>(['happiness', 'safety', 'communication'])

function formDataFromCampReview(review: CampReview): FormData {
  const v = review.visit ?? {}
  const r = review.ratings ?? {}
  const n = (x: unknown) => (typeof x === 'number' && !Number.isNaN(x) ? x : 0)

  const happinessTags: string[] = []
  const safetyTags: string[] = []
  const communicationTags: string[] = []
  for (const t of review.tags) {
    if (t.dimension === 'happiness') happinessTags.push(t.tagValue)
    else if (t.dimension === 'safety') safetyTags.push(t.tagValue)
    else if (t.dimension === 'communication') communicationTags.push(t.tagValue)
  }

  const kidCount = Math.min(4, Math.max(1, v.kidCount ?? 1))
  let kidAges =
    v.kidAges && v.kidAges.length > 0 ? [...v.kidAges].slice(0, kidCount) : Array(kidCount).fill(10)
  while (kidAges.length < kidCount) kidAges = [...kidAges, 10]

  return {
    visitMonth: v.month != null && v.month >= 1 && v.month <= 12 ? v.month : 0,
    visitYear: v.year != null && v.year >= MIN_VISIT_YEAR ? v.year : currentYear - 1,
    kidCount,
    kidAges,
    kidTags: v.kidTags ?? [],
    happinessRating: n(r.happiness),
    happinessTags,
    safetyRating: n(r.safety),
    safetyTags,
    communicationRating: n(r.communication),
    communicationTags,
    asDescribedRating: n(r.asDescribed),
    growthRating: n(r.growth),
    valueRating: n(r.value),
    reviewText: review.reviewText ?? '',
    agreeDisclaimer: false,
  }
}

const DIM_SUMMARY: { key: keyof FormData; apiKey: string; label: string }[] = [
  { key: 'happinessRating', apiKey: 'happiness', label: "Kid's Experience" },
  { key: 'safetyRating', apiKey: 'safety', label: 'Safety' },
  { key: 'communicationRating', apiKey: 'communication', label: 'Communication' },
  { key: 'asDescribedRating', apiKey: 'as_described', label: 'As described' },
  { key: 'growthRating', apiKey: 'growth', label: 'Growth & learning' },
  { key: 'valueRating', apiKey: 'value', label: 'Value for money' },
]

function ReviewTagPill({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Button
      radius="full"
      variant={selected ? 'solid' : 'bordered'}
      onPress={onPress}
      className={cn(
        'h-auto min-h-9 border border-default-200 px-4 py-2 text-sm font-medium text-default-900',
        selected && 'border-secondary bg-default-100'
      )}
    >
      {label}
    </Button>
  )
}

function SummaryStarRow({ value }: { value: number }) {
  if (value <= 0) {
    return <span className="text-default-500 dark:text-slate-400">—</span>
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-primary-600 dark:text-primary-400">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={cn(
            'size-3',
            n <= value
              ? 'fill-primary-500 text-primary-500'
              : 'fill-transparent stroke-default-300 text-default-300 dark:stroke-slate-500'
          )}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

const WriteReviewCampPage = () => {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const campId = params.campId as string
  const reviewId = searchParams.get('reviewId') ?? undefined
  const bookingGroupIdFromUrl = searchParams.get('bookingGroupId') ?? undefined
  const bookingIdFromUrl = searchParams.get('bookingId') ?? undefined

  const { allCamps, attended, addReview, updateReview, fetchEligible } = useReviewsStore()

  const [loadedReview, setLoadedReview] = useState<CampReview | null>(null)
  const [isReviewLoading, setIsReviewLoading] = useState(Boolean(reviewId))
  const [reviewError, setReviewError] = useState<string | null>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<FormData>({
    visitMonth: 0,
    visitYear: currentYear - 1,
    kidCount: 1,
    kidAges: [10],
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
    reviewText: '',
    agreeDisclaimer: false,
  })

  useEffect(() => {
    void fetchEligible()
  }, [fetchEligible])

  useEffect(() => {
    if (!reviewId) {
      setLoadedReview(null)
      setReviewError(null)
      setIsReviewLoading(false)
      return
    }
    let cancelled = false
    setIsReviewLoading(true)
    setReviewError(null)
    void reviewsService.getById(reviewId).then(res => {
      if (cancelled) return
      if (!res.success) {
        setIsReviewLoading(false)
        const msg =
          res.data && typeof res.data === 'object' && 'message' in res.data
            ? String((res.data as { message?: string }).message)
            : 'Could not load review'
        setReviewError(msg || 'Could not load review')
        return
      }
      const raw = (res.data as { review?: unknown }).review
      if (raw == null || typeof raw !== 'object') {
        setIsReviewLoading(false)
        setReviewError('Invalid review response')
        return
      }
      const review = normalizeCampReviewFromApi(raw)
      if (review.campId !== campId) {
        setIsReviewLoading(false)
        setReviewError('This review does not match the camp in the address bar.')
        return
      }
      setLoadedReview(review)
      setForm(formDataFromCampReview(review))
      setStepIndex(0)
      setIsReviewLoading(false)
      setReviewError(null)
    })
    return () => {
      cancelled = true
    }
  }, [reviewId, campId])

  const effectiveBookingGroupId = bookingGroupIdFromUrl ?? loadedReview?.bookingGroupId ?? undefined
  const effectiveBookingId = bookingIdFromUrl ?? loadedReview?.bookingId ?? undefined
  const isVerified = !!effectiveBookingId

  const camp = useMemo(() => {
    const fromAttended = attended.find(a => a.id === campId)
    if (fromAttended) return fromAttended
    const fromAll = allCamps.find(c => c.id === campId)
    if (fromAll) return fromAll
    const campFromReview = loadedReview?.campId === campId ? loadedReview?.camp : undefined
    if (campFromReview) {
      return {
        id: campFromReview.id,
        name: campFromReview.name,
        locationName: campFromReview.locationName ?? null,
        photos: campFromReview.photos,
        slug: campFromReview.slug,
      }
    }
    return undefined
  }, [campId, attended, allCamps, loadedReview])

  const campPhotos = camp?.photos as { url?: string; isPrimary?: boolean }[] | null | undefined
  const campImageUrl = campPhotos?.find(p => p.isPrimary)?.url ?? campPhotos?.[0]?.url

  const steps: StepKey[] = useMemo(
    () =>
      isVerified
        ? ['happiness', 'safety', 'communication', 'dims', 'story', 'submit']
        : ['visit', 'happiness', 'safety', 'communication', 'dims', 'story', 'submit'],
    [isVerified]
  )

  const currentStep = steps[stepIndex]
  const progressPct = ((stepIndex + 1) / steps.length) * 100

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const toggleTag = (
    field: 'happinessTags' | 'safetyTags' | 'communicationTags' | 'kidTags',
    value: string
  ) => {
    setForm(f => {
      const cur = f[field] as string[]
      return {
        ...f,
        [field]: cur.includes(value) ? cur.filter(t => t !== value) : [...cur, value],
      }
    })
  }

  const stepComplete = (step: StepKey): boolean => {
    switch (step) {
      case 'happiness':
        return form.happinessRating > 0
      case 'safety':
        return form.safetyRating > 0
      case 'communication':
        return form.communicationRating > 0
      default:
        return true
    }
  }

  const hasDimsInput = form.asDescribedRating > 0 || form.growthRating > 0 || form.valueRating > 0
  const hasStoryInput = form.reviewText.trim().length > 0

  const footerNextDisabled = REQUIRED_STEPS.has(currentStep) && !stepComplete(currentStep)

  const footerNextDisabledReason = (() => {
    if (!footerNextDisabled) return undefined
    switch (currentStep) {
      case 'happiness':
        return 'Please add star rating to continue.'
      case 'safety':
        return 'Please add star rating to continue.'
      case 'communication':
        return 'Please add star rating to continue.'
      default:
        return undefined
    }
  })()

  const footerNextLabel = (() => {
    if (currentStep === 'dims') return hasDimsInput ? 'Next' : 'Skip'
    if (currentStep === 'story') return hasStoryInput ? 'Next' : 'Skip'
    return 'Next'
  })()

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(i => i + 1)
      if (typeof window !== 'undefined') window.scrollTo(0, 0)
    }
  }

  const goBack = () => {
    if (stepIndex > 0) {
      setStepIndex(i => i - 1)
      if (typeof window !== 'undefined') window.scrollTo(0, 0)
    }
  }

  const handleClose = () => {
    router.push('/reviews/write')
  }

  const handleSubmit = async () => {
    if (!form.agreeDisclaimer) return
    setIsSubmitting(true)
    const tags: CreateReviewPayload['tags'] = []
    for (const dim of ['happiness', 'safety', 'communication'] as ReviewTagDimension[]) {
      const dimTags = form[`${dim}Tags` as keyof FormData] as string[]
      for (const tagValue of dimTags) {
        tags.push({ dimension: dim, tagValue })
      }
    }

    const visitPart = isVerified
      ? {}
      : {
          ...(form.visitMonth >= 1 && form.visitMonth <= 12
            ? { visitMonth: form.visitMonth, visitYear: form.visitYear }
            : {}),
          kidCount: form.kidCount,
          kidAges: form.kidAges.slice(0, form.kidCount),
          kidTags: form.kidTags,
        }

    const bodyCommon = {
      ...visitPart,
      happinessRating: form.happinessRating || undefined,
      safetyRating: form.safetyRating || undefined,
      communicationRating: form.communicationRating || undefined,
      asDescribedRating: form.asDescribedRating || undefined,
      growthRating: form.growthRating || undefined,
      valueRating: form.valueRating || undefined,
      tags,
      reviewText: form.reviewText.trim() || undefined,
    }

    let res: CampReview | null = null
    if (reviewId) {
      res = await updateReview(reviewId, bodyCommon)
    } else {
      res = await addReview({
        campId,
        bookingGroupId: effectiveBookingGroupId,
        bookingId: effectiveBookingId,
        ...bodyCommon,
        status: 'pending',
      })
    }
    setIsSubmitting(false)
    if (res) setShowConfirm(true)
  }

  const summaryOverall = useMemo(() => {
    let total = 0
    let count = 0
    for (const { key } of DIM_SUMMARY) {
      const v = form[key] as number
      if (v > 0) {
        total += v
        count += 1
      }
    }
    if (count === 0) return null
    return (total / count).toFixed(1)
  }, [form])

  const summaryTitle = useMemo(() => {
    if (!camp) return ''
    if (!isVerified && form.visitMonth >= 1 && form.visitMonth <= 12) {
      return `${camp.name} · ${MONTHS[form.visitMonth - 1]} ${form.visitYear}`
    }
    return camp.name
  }, [camp, isVerified, form.visitMonth, form.visitYear])

  if (reviewId && isReviewLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-default-900 dark:text-white">Loading review…</p>
        <p className="mt-2 text-sm text-default-500">Fetching your saved answers.</p>
      </div>
    )
  }

  if (reviewId && reviewError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-default-900 dark:text-white">
          Couldn&apos;t open this review
        </p>
        <p className="mt-2 text-sm text-default-500">{reviewError}</p>
        <Button
          radius="lg"
          onPress={() => router.push('/reviews')}
          className="mt-6 bg-default-900 px-6 py-3 text-base font-bold text-white dark:bg-white dark:text-default-900"
        >
          Back to my reviews
        </Button>
      </div>
    )
  }

  if (!camp) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-default-900 dark:text-white">Camp not found</p>
        <p className="mt-2 text-sm text-default-500">This camp may no longer be available.</p>
        <Button
          radius="lg"
          onPress={() => router.push('/reviews/write')}
          className="mt-6 bg-default-900 px-6 py-3 text-base font-bold text-white dark:bg-white dark:text-default-900"
        >
          Choose a camp
        </Button>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center md:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary-50 text-4xl text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 md:size-20 md:text-4xl">
            <Check className="size-9 md:size-10" strokeWidth={3} />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold leading-tight text-default-900 dark:text-white md:text-3xl">
            {reviewId ? 'Review saved' : 'Thanks for your review!'}
          </h1>
          <p className="mb-10 text-base leading-relaxed text-default-500 dark:text-slate-400">
            {reviewId
              ? 'Your changes are live on the camp profile.'
              : "Your review is now live on the camp's profile. It'll help other families make the right choice."}
          </p>
          <Button
            radius="lg"
            onPress={() => router.push('/reviews')}
            color="secondary"
            className="w-full mb-6"
          >
            Done
          </Button>
          <Link href="/reviews" className="block text-sm text-default-500 underline">
            Go to my reviews
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WriteReviewFlowHeader
        onBack={stepIndex > 0 ? goBack : handleClose}
        onClose={handleClose}
        showBack
        camp={{
          name: camp.name,
          locationName: camp.locationName,
          imageUrl: campImageUrl ?? null,
        }}
      />
      <WriteReviewFlowProgress progressPct={progressPct} />

      <div className="flex-1 overflow-y-auto">
        <WriteReviewStepContent>
          {currentStep === 'visit' && (
            <>
              <h2 className="mb-2 text-2xl font-bold leading-tight text-default-900 dark:text-white md:text-3xl">
                About Your Kid&apos;s Visit
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-default-500 dark:text-slate-400 md:text-base">
                A few details to make your review more useful for families searching for camps.
              </p>

              <div className="mb-7">
                <span className="mb-1.5 block text-base font-semibold text-default-900 dark:text-white">
                  When did you attend?
                </span>
                <div className="flex gap-2.5">
                  <SelectField
                    aria-label="Visit month"
                    placeholder="Month"
                    options={MONTH_SELECT_OPTIONS}
                    value={form.visitMonth === 0 ? MONTH_EMPTY : String(form.visitMonth)}
                    onChange={v => setField('visitMonth', v === MONTH_EMPTY ? 0 : Number(v))}
                    className="min-w-0 flex-1"
                    classNames={visitSelectClassNames}
                  />
                  <SelectField
                    aria-label="Visit year"
                    placeholder="Year"
                    options={YEAR_SELECT_OPTIONS}
                    value={String(form.visitYear)}
                    onChange={v => setField('visitYear', Number(v))}
                    className="min-w-0 flex-1"
                    classNames={visitSelectClassNames}
                  />
                </div>
              </div>

              <div className="mb-7">
                <span className="mb-2.5 block text-base font-semibold text-default-900 dark:text-white">
                  How many kids attended?
                </span>
                <div className="mt-1 inline-flex items-stretch overflow-hidden rounded-xl border-2 border-default-200 dark:border-slate-600">
                  <Button
                    isIconOnly
                    variant="light"
                    radius="none"
                    isDisabled={form.kidCount <= 1}
                    onPress={() => {
                      const n = Math.max(1, form.kidCount - 1)
                      setField('kidCount', n)
                      setField('kidAges', form.kidAges.slice(0, n))
                    }}
                    className="size-12 min-w-12 text-default-900 dark:text-white"
                    aria-label="Decrease number of kids"
                  >
                    <Minus className="size-5" strokeWidth={2} />
                  </Button>
                  <span className="flex min-w-12 items-center justify-center border-x-2 border-default-200 px-2 text-lg font-bold dark:border-slate-600">
                    {form.kidCount}
                  </span>
                  <Button
                    isIconOnly
                    variant="light"
                    radius="none"
                    isDisabled={form.kidCount >= 4}
                    onPress={() => {
                      const n = Math.min(4, form.kidCount + 1)
                      setField('kidCount', n)
                      setField('kidAges', [...form.kidAges, 10].slice(0, n))
                    }}
                    className="size-12 min-w-12 text-default-900 dark:text-white"
                    aria-label="Increase number of kids"
                  >
                    <Plus className="size-5" strokeWidth={2} />
                  </Button>
                </div>

                <div className="mt-5 flex flex-col">
                  {Array.from({ length: form.kidCount }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 border-b border-default-100 py-3 first:border-t dark:border-slate-800"
                    >
                      <span className="text-base font-semibold text-default-900 dark:text-white">
                        Kid {i + 1}
                      </span>
                      <SelectField
                        aria-label={`Age for kid ${i + 1}`}
                        options={AGE_SELECT_OPTIONS}
                        value={String(form.kidAges[i] ?? 10)}
                        onChange={v => {
                          const ages = [...form.kidAges]
                          ages[i] = Number(v)
                          setField('kidAges', ages)
                        }}
                        className="w-1/2 min-w-0 max-w-xs shrink-0"
                        classNames={visitSelectClassNames}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {form.kidCount === 1 ? (
                <div className="mb-2">
                  <span className="mb-1 block text-base font-semibold text-default-900 dark:text-white">
                    About Your Kid{' '}
                    <span className="font-normal text-default-500 dark:text-slate-400">
                      (optional)
                    </span>
                  </span>
                  <span className="mb-3 block text-sm text-default-500 dark:text-slate-400">
                    Helps parents with similar kids find your review
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {PERSONALITY_TAG_OPTIONS.map(({ value, label }) => (
                      <ReviewTagPill
                        key={value}
                        label={label}
                        selected={form.kidTags.includes(value)}
                        onPress={() => toggleTag('kidTags', value)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {(['happiness', 'safety', 'communication'] as const).includes(
            currentStep as 'happiness' | 'safety' | 'communication'
          ) &&
            (() => {
              const dim = currentStep as 'happiness' | 'safety' | 'communication'
              const config = REVIEW_TAG_CONFIG[dim]
              const ratingField = `${dim}Rating` as keyof FormData
              const tagsField = `${dim}Tags` as 'happinessTags' | 'safetyTags' | 'communicationTags'
              const questions: Record<typeof dim, { q: string; sub: string }> = {
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
                  <h2 className="mb-2 text-2xl font-bold leading-tight text-default-900 dark:text-white md:text-3xl">
                    {q}
                  </h2>
                  <p className="mb-8 text-sm leading-relaxed text-default-500 dark:text-slate-400 md:text-base">
                    {sub}
                  </p>
                  <WriteReviewFlowBigStars
                    value={form[ratingField] as number}
                    onChange={v => setField(ratingField, v)}
                  />
                  <Divider className="mb-6 bg-default-100 dark:bg-slate-800" />
                  <div className="mb-3 text-base font-semibold text-default-900 dark:text-white">
                    What stood out?
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {config.tags.map(tag => (
                      <ReviewTagPill
                        key={tag.value}
                        label={tag.title}
                        selected={(form[tagsField] as string[]).includes(tag.value)}
                        onPress={() => toggleTag(tagsField, tag.value)}
                      />
                    ))}
                  </div>
                </>
              )
            })()}

          {currentStep === 'dims' && (
            <>
              <h2 className="mb-2 text-2xl font-bold leading-tight text-default-900 dark:text-white md:text-3xl">
                A few more ratings
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-default-500 dark:text-slate-400 md:text-base">
                Optional — these help parents find the right camp for their kid.
              </p>
              {(
                [
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
                ] as const
              ).map(({ label, desc, field }) => (
                <div
                  key={field}
                  className="border-b border-default-100 py-5 last:border-b-0 dark:border-slate-800"
                >
                  <div className="mb-0.5 text-lg font-semibold text-default-900 dark:text-white">
                    {label}
                  </div>
                  <p className="mb-3 text-sm text-default-500 dark:text-slate-400">{desc}</p>
                  <WriteReviewFlowCompactStars
                    value={form[field]}
                    onChange={v => setField(field, v)}
                  />
                </div>
              ))}
            </>
          )}

          {currentStep === 'story' && (
            <>
              <h2 className="mb-2 text-2xl font-bold leading-tight text-default-900 dark:text-white md:text-3xl">
                Anything you&apos;d like to share?
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-default-500 dark:text-slate-400 md:text-base">
                Your words help other families find the right camp. No pressure — skip if you
                prefer.
              </p>
              <Textarea
                value={form.reviewText}
                onValueChange={v => setField('reviewText', v.slice(0, 800))}
                maxLength={800}
                minRows={6}
                placeholder="e.g. We chose this camp for the small group sizes. Communication was excellent — daily photo updates really reassured us as first-time camp parents. One tip: bring extra spending money for the camp shop!"
              />
              <p className="mt-1 text-right text-xs text-default-400 dark:text-slate-500">
                {form.reviewText.length}/800
              </p>
            </>
          )}

          {currentStep === 'submit' && (
            <>
              <h2 className="mb-2 text-2xl font-bold leading-tight text-default-900 dark:text-white md:text-3xl">
                Submit your review
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-default-500 dark:text-slate-400 md:text-base">
                Take a moment to review before publishing. Your review will appear publicly after a
                short moderation check.
              </p>

              <div className="mb-6 rounded-2xl bg-default-100 p-4 dark:bg-slate-800">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-default-200 dark:bg-slate-700">
                    {campImageUrl ? (
                      <img src={campImageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm font-semibold text-default-500">
                        {camp.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-sm font-semibold text-default-900 dark:text-white">
                    {summaryTitle}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {DIM_SUMMARY.map(({ key, label }) => {
                    const val = form[key] as number
                    return (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-default-500 dark:text-slate-400">{label}</span>
                        <SummaryStarRow value={val} />
                      </div>
                    )
                  })}
                </div>
                <Divider className="my-2.5 bg-default-100 dark:bg-slate-700" />
                <div className="flex items-center justify-between text-sm font-bold text-default-900 dark:text-white">
                  <span>Overall</span>
                  <span className="inline-flex items-center gap-1">
                    {summaryOverall ? (
                      <>
                        <Star
                          className="size-4 fill-primary-500 text-primary-500"
                          strokeWidth={0}
                        />
                        {summaryOverall}
                      </>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              <div className="mb-5 flex gap-2.5">
                <Checkbox
                  isSelected={form.agreeDisclaimer}
                  onValueChange={v => setField('agreeDisclaimer', v)}
                  classNames={{
                    base: 'items-start',
                    label: 'text-xs leading-relaxed text-default-500',
                  }}
                >
                  I certify that this review is based on my own genuine experience and I have no
                  personal or business relationship with this camp, and have not been offered any
                  incentive to write this review.{' '}
                  <Link href="/privacy-policy" className="font-semibold text-default-900 underline">
                    Learn more
                  </Link>
                  .
                </Checkbox>
              </div>

              <Tooltip
                content="Please accept the disclaimer to continue."
                isDisabled={form.agreeDisclaimer || isSubmitting}
                placement="top"
                closeDelay={0}
              >
                <span className="block w-full">
                  <Button
                    radius="lg"
                    onPress={handleSubmit}
                    isDisabled={!form.agreeDisclaimer || isSubmitting}
                    isLoading={isSubmitting}
                    className="w-full"
                    color="secondary"
                  >
                    {reviewId ? 'Save changes' : 'Publish review'}
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </WriteReviewStepContent>
      </div>

      <WriteReviewFlowFooter
        showBack={stepIndex > 0}
        onBack={goBack}
        showNext={currentStep !== 'submit'}
        nextLabel={footerNextLabel}
        nextDisabled={footerNextDisabled}
        nextDisabledReason={footerNextDisabledReason}
        onNext={goNext}
      />
    </div>
  )
}

export default WriteReviewCampPage
