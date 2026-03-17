'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, CardBody, CardHeader, Chip, Switch } from '@heroui/react'
import { CheckCircle, CircleAlert, Loader2 } from 'lucide-react'
import {
  cn,
  EmojiPicker,
  Input,
  SelectField,
  useConfirmDialog,
  useDebounce,
} from '@world-schools/ui-web'
import {
  type ActivityScaleColorKey,
  type ActivityScaleVisualType,
  type AdminActivity,
  type AdminCategory,
  catalogueService,
  type CreateActivityPayload,
  type ScaleWithUsage,
  type UpdateActivityPayload,
} from '@/services/catalogue.services'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function colorPalette(key?: string) {
  switch (key as ActivityScaleColorKey) {
    case 'TEAL':
      return { dot: 'bg-primary-700', chipBg: 'bg-primary-50', chipText: 'text-primary-700' }
    case 'AMBER':
      return { dot: 'bg-warning', chipBg: 'bg-warning-50', chipText: 'text-warning-700' }
    case 'PURPLE':
    default:
      return { dot: 'bg-secondary', chipBg: 'bg-secondary-50', chipText: 'text-secondary' }
  }
}

type ActivityFormBaseValues = {
  name: string
  slug: string
  emoji: string
  categoryId: string
  scaleId: string
  isActive: boolean
}

export type CatalogueActivityFormMode = 'create' | 'edit'

type CatalogueActivityFormProps =
  | {
      mode: 'create'
      initialCategoryId?: string | null
      categories: AdminCategory[]
      scales: ScaleWithUsage[]
      activity?: null
      isSaving?: boolean
      isDeleting?: never
      onSubmit: (categoryId: string, payload: CreateActivityPayload) => Promise<boolean>
      onDelete?: never
    }
  | {
      mode: 'edit'
      categories: AdminCategory[]
      scales: ScaleWithUsage[]
      activity: AdminActivity
      categoryId: string
      isSaving?: boolean
      isDeleting?: boolean
      onSubmit: (id: string, payload: UpdateActivityPayload) => Promise<boolean>
      onDelete?: () => Promise<boolean>
    }

export function CatalogueActivityForm(props: CatalogueActivityFormProps) {
  const { mode, categories, scales, isSaving, isDeleting } = props
  const { confirm } = useConfirmDialog()
  const activity = mode === 'edit' ? props.activity : null
  const activityId = activity?.id
  const onDelete = mode === 'edit' ? props.onDelete : undefined
  const editCategoryId = mode === 'edit' ? props.categoryId : null

  const initialValues: ActivityFormBaseValues = useMemo(() => {
    const categoryId =
      mode === 'edit'
        ? props.categoryId
        : props.initialCategoryId && categories.some(c => c.id === props.initialCategoryId)
          ? (props.initialCategoryId as string)
          : (categories[0]?.id ?? '')

    return {
      name: activity?.name ?? '',
      slug: activity?.slug ?? '',
      emoji: activity?.emoji ?? '⚽',
      categoryId,
      scaleId: activity?.scaleId ?? '',
      isActive: activity?.isActive ?? true,
    }
  }, [
    activity?.emoji,
    activity?.isActive,
    activity?.name,
    activity?.scaleId,
    activity?.slug,
    categories,
    mode,
    props,
  ])

  const [name, setName] = useState(initialValues.name)
  const [slug, setSlug] = useState(initialValues.slug)
  const [emoji, setEmoji] = useState(initialValues.emoji)
  const [categoryId, setCategoryId] = useState(initialValues.categoryId)
  const [scaleId, setScaleId] = useState(initialValues.scaleId)
  const [isActive, setIsActive] = useState(initialValues.isActive)

  const [errors, setErrors] = useState<{ name?: string; slug?: string; categoryId?: string }>({})

  const userHasEditedSlugRef = useRef(false)
  const debouncedSlug = useDebounce(slug, 500)
  const debouncedCategoryId = useDebounce(categoryId, 200)
  const [slugError, setSlugError] = useState<string | null>(null)
  type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable'
  const [slugCheckStatus, setSlugCheckStatus] = useState<SlugCheckStatus>('idle')

  // Auto-generate slug in create mode until user edits it.
  useEffect(() => {
    if (mode !== 'create') return
    const generated = generateSlug(name)
    if (!userHasEditedSlugRef.current) setSlug(generated)
  }, [mode, name])

  // Validate slug availability (per category)
  useEffect(() => {
    const validateSlug = async () => {
      if (!debouncedCategoryId) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      if (!debouncedSlug) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      // Skip if editing and slug/category unchanged.
      if (
        mode === 'edit' &&
        activity?.slug &&
        debouncedSlug === activity.slug &&
        debouncedCategoryId === editCategoryId
      ) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugRegex.test(debouncedSlug)) {
        setSlugError('Slug must be lowercase alphanumeric with hyphens only')
        setSlugCheckStatus('unavailable')
        return
      }

      setSlugCheckStatus('checking')
      const res = await catalogueService.checkActivitySlugAvailability(
        debouncedSlug,
        debouncedCategoryId,
        mode === 'edit' ? activityId : undefined
      )

      if (res.success && res.data) {
        if (!res.data.available) {
          setSlugError('This slug is already in use in the selected category')
          setSlugCheckStatus('unavailable')
        } else {
          setSlugError(null)
          setSlugCheckStatus('available')
        }
      } else {
        setSlugCheckStatus('idle')
      }
    }

    void validateSlug()
  }, [activity?.slug, activityId, debouncedCategoryId, debouncedSlug, editCategoryId, mode])

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === categoryId) ?? null,
    [categories, categoryId]
  )

  const selectedScale = useMemo(
    () => (scaleId ? (scales.find(s => s.id === scaleId) ?? null) : null),
    [scales, scaleId]
  )

  const palette = colorPalette(selectedScale?.colorKey)
  const scaleLevels = useMemo(() => {
    const levels = [...(selectedScale?.levels ?? [])]
    levels.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return levels
  }, [selectedScale?.levels])

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    const nextErrors: typeof errors = {}
    if (!categoryId) nextErrors.categoryId = 'Category is required'
    if (!trimmedName) nextErrors.name = 'Activity name is required'
    if (!trimmedSlug) nextErrors.slug = 'Slug is required'
    if (slugError) nextErrors.slug = slugError
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (mode === 'create') {
      const payload: CreateActivityPayload = {
        name: trimmedName,
        slug: trimmedSlug,
        emoji: emoji.trim() || undefined,
        scaleId: scaleId || undefined,
      }
      await props.onSubmit(categoryId, payload)
      return
    }

    const payload: UpdateActivityPayload = {
      name: trimmedName,
      slug: trimmedSlug,
      categoryId,
      emoji: emoji.trim() || undefined,
      scaleId: scaleId ? scaleId : null,
      isActive,
    }
    await props.onSubmit(activityId!, payload)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    const ok = await confirm({
      title: 'Delete activity?',
      message:
        'Permanently removes this activity from the catalogue. Any child interests/skills using it may block deletion. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    await onDelete()
  }

  const categoryOptions = useMemo(
    () => categories.map(c => ({ value: c.id, label: `${c.emoji ?? '📁'} ${c.name}` })),
    [categories]
  )

  const scaleOptions = useMemo(
    () => [
      { value: '', label: 'None — interest only, no level tracking' },
      ...scales.map(s => ({ value: s.id, label: `${s.id} — ${s.name}` })),
    ],
    [scales]
  )

  return (
    <form
      id="catalogue-activity-form"
      onSubmit={e => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="space-y-5 max-w-3xl"
    >
      <Card className="border border-default-200 shadow-none">
        <CardHeader className="border-b border-default-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">
            Activity details
          </p>
        </CardHeader>
        <CardBody className="gap-4 p-6">
          <div className="flex gap-4">
            <EmojiPicker label="Emoji" value={emoji} onChange={setEmoji} />
            <Input
              label="Activity name"
              placeholder="e.g. Football"
              value={name}
              onValueChange={setName}
              isRequired
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              className="w-full"
            />
            <SelectField
              label="Category"
              isRequired
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Select category..."
              errorMessage={errors.categoryId}
              isInvalid={!!errors.categoryId}
              classNames={{
                base: 'w-full',
              }}
            />
          </div>

          <Input
            label="Slug"
            placeholder="activity-slug"
            value={slug}
            onValueChange={val => {
              userHasEditedSlugRef.current = true
              setSlug(val)
            }}
            isRequired
            errorMessage={errors.slug || slugError}
            isInvalid={!!errors.slug || !!slugError}
            description="Must be unique within the selected category. Used as a stable identifier."
            classNames={{
              input: 'font-mono text-sm',
            }}
            endContent={
              slugCheckStatus === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin text-default-400" />
              ) : slugCheckStatus === 'available' ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : slugCheckStatus === 'unavailable' && slugError ? (
                <CircleAlert className="h-4 w-4 text-danger" />
              ) : null
            }
          />
        </CardBody>
      </Card>

      <Card className="border border-default-200 shadow-none">
        <CardHeader className="border-b border-default-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">Skill scale</p>
        </CardHeader>
        <CardBody className="gap-4 p-6">
          <SelectField
            label="Scale type"
            value={scaleId}
            onChange={setScaleId}
            options={scaleOptions}
            placeholder="Select scale..."
            description="Activities with a skill scale can be used in camp eligibility requirements and child skill profiles."
            classNames={{ base: 'mt-0!' }}
          />

          <div className="rounded-xl bg-default-50 border border-default-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-default-500">Preview</p>
            {!selectedScale ? (
              <p className="mt-3 text-sm text-default-500 italic leading-relaxed">
                No level tracking — this activity appears as a simple interest tag. Parents can
                select it but won’t be asked for a level.
              </p>
            ) : (selectedScale.visualType as ActivityScaleVisualType) === 'GRID' ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {scaleLevels.map(lvl => (
                  <div
                    key={lvl.id}
                    className={cn(
                      'rounded-lg border border-default-200 px-3 py-2 text-center',
                      palette.chipBg
                    )}
                  >
                    <div className={cn('text-sm font-bold font-mono', palette.chipText)}>
                      {(lvl.value || '?').toUpperCase()}
                    </div>
                    <div className={cn('text-[11px] mt-0.5', palette.chipText)}>{lvl.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {scaleLevels.map((lvl, idx) => (
                  <div key={lvl.id} className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {Array.from({ length: scaleLevels.length }, (_, j) => (
                        <span
                          key={j}
                          className={cn(
                            'h-2 w-2 rounded-full',
                            j <= idx ? palette.dot : 'bg-default-300'
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-default-700">
                      {lvl.label || lvl.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedScale ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Chip
                  size="sm"
                  variant="flat"
                  className={cn('font-mono', palette.chipBg, palette.chipText)}
                >
                  {selectedScale.id}
                </Chip>
                <span className="text-xs text-default-500">{selectedScale.name}</span>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200 shadow-none">
        <CardHeader className="border-b border-default-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">Visibility</p>
        </CardHeader>
        <CardBody className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="mt-1 text-xs text-default-500">
                Visible to providers in the camp editor and to parents in the child interest picker
              </p>
            </div>
            <Switch size="sm" isSelected={isActive} onValueChange={setIsActive} />
          </div>
        </CardBody>
      </Card>

      {mode === 'edit' && onDelete ? (
        <Card className="border border-danger-200 bg-danger-50/40 shadow-none">
          <CardBody className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-danger">Delete this activity</p>
              <p className="mt-1 text-sm text-default-600">
                Permanently removes {activity?.name ? `"${activity.name}"` : 'this activity'} from
                the catalogue. This cannot be undone.
              </p>
              {selectedCategory ? (
                <p className="mt-2 text-xs text-default-500">
                  Category:{' '}
                  <span className="font-medium text-default-700">{selectedCategory.name}</span>
                </p>
              ) : null}
            </div>
            <Button
              color="danger"
              variant="flat"
              onPress={() => void handleDelete()}
              isLoading={isDeleting}
              isDisabled={!!isSaving}
            >
              Delete activity
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <div className="hidden">
        <Button type="submit" isLoading={isSaving} />
      </div>
    </form>
  )
}
