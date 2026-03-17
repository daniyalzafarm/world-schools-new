'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, CardBody, CardHeader, Switch } from '@heroui/react'
import { CheckCircle, CircleAlert, Loader2 } from 'lucide-react'
import { cn, EmojiPicker, Input, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import {
  type ActivityCategoryStatus,
  type AdminCategory,
  catalogueService,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from '@/services/catalogue.services'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type BaseValues = {
  name: string
  slug: string
  emoji: string
  status: ActivityCategoryStatus
  surfaceParentInterests: boolean
  surfaceCampFocus: boolean
  surfaceCampInterests: boolean
}

export type CatalogueCategoryFormMode = 'create' | 'edit'

type CatalogueCategoryFormProps =
  | {
      mode: 'create'
      category?: null
      isSaving?: boolean
      isDeleting?: never
      onSubmit: (payload: CreateCategoryPayload) => Promise<boolean>
      onDelete?: never
    }
  | {
      mode: 'edit'
      category: AdminCategory
      isSaving?: boolean
      isDeleting?: boolean
      onSubmit: (payload: UpdateCategoryPayload) => Promise<boolean>
      onDelete?: () => Promise<boolean>
    }

export function CatalogueCategoryForm(props: CatalogueCategoryFormProps) {
  const { mode, category, isSaving, isDeleting, onSubmit } = props
  const onDelete = mode === 'edit' ? props.onDelete : undefined
  const { confirm } = useConfirmDialog()

  const initialValues: BaseValues = useMemo(
    () => ({
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      emoji: category?.emoji ?? '🏃',
      status: category?.status ?? 'DRAFT',
      surfaceParentInterests: category?.surfaceParentInterests ?? true,
      surfaceCampFocus: category?.surfaceCampFocus ?? true,
      surfaceCampInterests: category?.surfaceCampInterests ?? true,
    }),
    [category]
  )

  const [name, setName] = useState(initialValues.name)
  const [slug, setSlug] = useState(initialValues.slug)
  const [emoji, setEmoji] = useState(initialValues.emoji)
  const [status, setStatus] = useState<ActivityCategoryStatus>(initialValues.status)
  const [surfaceParentInterests, setSurfaceParentInterests] = useState(
    initialValues.surfaceParentInterests
  )
  const [surfaceCampFocus, setSurfaceCampFocus] = useState(initialValues.surfaceCampFocus)
  const [surfaceCampInterests, setSurfaceCampInterests] = useState(
    initialValues.surfaceCampInterests
  )

  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({})

  const userHasEditedSlugRef = useRef(false)
  const debouncedSlug = useDebounce(slug, 500)
  const [slugError, setSlugError] = useState<string | null>(null)
  type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable'
  const [slugCheckStatus, setSlugCheckStatus] = useState<SlugCheckStatus>('idle')

  // Auto-generate slug from name in create mode (real-time); stop overwriting once user edits slug
  useEffect(() => {
    if (mode !== 'create') return
    const generated = generateSlug(name)
    if (!userHasEditedSlugRef.current) {
      setSlug(generated)
    }
  }, [name, mode])

  // Validate slug availability (KB-like)
  useEffect(() => {
    const validateSlug = async () => {
      if (!debouncedSlug) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      // Skip validation if editing and slug hasn't changed
      if (mode === 'edit' && category?.slug && debouncedSlug === category.slug) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugRegex.test(debouncedSlug)) {
        setSlugError('Slug must be lowercase alphanumeric with hyphens only')
        setSlugCheckStatus('unavailable')
        return
      }

      setSlugCheckStatus('checking')
      const res = await catalogueService.checkCategorySlugAvailability(
        debouncedSlug,
        mode === 'edit' ? category?.id : undefined
      )

      if (res.success && res.data) {
        if (!res.data.available) {
          setSlugError('This slug is already in use')
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
  }, [debouncedSlug, mode, category?.id, category?.slug])

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedSlug = slug.trim()
    const nextErrors: { name?: string; slug?: string } = {}
    if (!trimmedName) nextErrors.name = 'Category name is required'
    if (!trimmedSlug) nextErrors.slug = 'Slug is required'
    if (slugError) nextErrors.slug = slugError
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (mode === 'create') {
      const payload: CreateCategoryPayload = {
        name: trimmedName,
        slug: trimmedSlug,
        emoji: emoji.trim() || undefined,
        status,
        surfaceParentInterests,
        surfaceCampFocus,
        surfaceCampInterests,
      }
      await (onSubmit as (payload: CreateCategoryPayload) => Promise<boolean>)(payload)
      return
    }

    const payload: UpdateCategoryPayload = {
      name: trimmedName,
      slug: trimmedSlug,
      emoji: emoji.trim() || undefined,
      status,
      surfaceParentInterests,
      surfaceCampFocus,
      surfaceCampInterests,
    }
    await (onSubmit as (payload: UpdateCategoryPayload) => Promise<boolean>)(payload)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    const ok = await confirm({
      title: 'Delete category?',
      message:
        'Permanently removes this category and all its activities from the catalogue. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    await onDelete()
  }

  const SurfaceItem = ({
    checked,
    onToggle,
    title,
    description,
  }: {
    checked: boolean
    onToggle: () => void
    title: string
    description: string
  }) => {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'cursor-pointer opacity-hover w-full text-left flex items-start gap-3 rounded-xl border-2 p-4 transition-colors',
          checked ? 'border-primary bg-primary-50' : 'border-default-200 hover:border-default-300'
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-default-500">{description}</div>
        </div>
      </button>
    )
  }

  return (
    <form
      id="catalogue-category-form"
      onSubmit={e => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="space-y-5 max-w-3xl"
    >
      <Card className="border border-default-200 shadow-none">
        <CardHeader className="border-b border-default-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">
            Category details
          </p>
        </CardHeader>
        <CardBody className="gap-4 p-6">
          <div className="flex gap-4">
            <EmojiPicker label="Emoji" value={emoji} onChange={setEmoji} />
            <Input
              label="Category name"
              placeholder="e.g. Sports & Outdoor"
              value={name}
              onValueChange={setName}
              isRequired
              isInvalid={!!errors.name}
              errorMessage={errors.name}
            />
          </div>

          <Input
            label="Slug"
            placeholder="category-slug"
            value={slug}
            onValueChange={val => {
              userHasEditedSlugRef.current = true
              setSlug(val)
            }}
            isRequired
            errorMessage={errors.slug || slugError}
            isInvalid={!!errors.slug || !!slugError}
            description="Must be unique. Used for stable identifiers."
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
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">Status</p>
        </CardHeader>
        <CardBody className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="mt-1 text-xs text-default-500">
                When off, this category is hidden from parents and providers everywhere
              </p>
            </div>
            <Switch
              size="sm"
              isSelected={status === 'ACTIVE'}
              onValueChange={selected => setStatus(selected ? 'ACTIVE' : 'DRAFT')}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="border border-default-200 shadow-none">
        <CardHeader className="border-b border-default-200 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-default-600">Appears on</p>
        </CardHeader>
        <CardBody className="gap-4 p-6">
          <p className="text-sm text-default-500">
            Choose where this category shows up across the platform.
          </p>

          <div className="space-y-2">
            <SurfaceItem
              checked={surfaceParentInterests}
              onToggle={() => setSurfaceParentInterests(v => !v)}
              title="👶 Parent — child interest picker"
              description="Parents can select activities in this category when setting up their child's profile."
            />
            <SurfaceItem
              checked={surfaceCampFocus}
              onToggle={() => setSurfaceCampFocus(v => !v)}
              title="🎯 Provider — camp focus selector"
              description="Providers can set this as the primary focus of their camp."
            />
            <SurfaceItem
              checked={surfaceCampInterests}
              onToggle={() => setSurfaceCampInterests(v => !v)}
              title="🏕️ Provider — camp activity tagger"
              description="Providers can tag their camp as covering this interest area in the camp editor."
            />
          </div>
        </CardBody>
      </Card>

      {mode === 'edit' && onDelete ? (
        <Card className="border border-danger-200 bg-danger-50/40 shadow-none">
          <CardBody className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-danger">Delete this category</p>
              <p className="mt-1 text-sm text-default-600">
                Permanently removes {category?.name ? `"${category.name}"` : 'this category'} and
                all its activities from the catalogue. This cannot be undone.
              </p>
            </div>
            <Button
              color="danger"
              variant="flat"
              onPress={() => void handleDelete()}
              isLoading={isDeleting}
              isDisabled={!!isSaving}
            >
              Delete
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
