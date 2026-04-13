'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, CardBody, CardHeader, Chip } from '@heroui/react'
import { CheckCircle, CircleAlert, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
import { cn, Input, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  type ActivityScaleColorKey,
  type ActivityScaleVisualType,
  catalogueService,
  type CreateScalePayload,
  type ScaleWithUsage,
  type UpdateScalePayload,
} from '@/services/catalogue.services'

type DotLevel = { id: string; name: string }
type GridLevel = { id: string; code: string; label: string }

type BaseValues = {
  id: string
  name: string
  description: string
  visualType: ActivityScaleVisualType
  colorKey: ActivityScaleColorKey
  dotLevels: DotLevel[]
  gridLevels: GridLevel[]
}

export type CatalogueScaleFormMode = 'create' | 'edit'

type CatalogueScaleFormProps =
  | {
      mode: 'create'
      scale?: null
      isSaving?: boolean
      isDeleting?: never
      onSubmit: (payload: CreateScalePayload) => Promise<boolean>
      onDelete?: never
    }
  | {
      mode: 'edit'
      scale: ScaleWithUsage
      isSaving?: boolean
      isDeleting?: boolean
      onSubmit: (payload: UpdateScalePayload) => Promise<boolean>
      onDelete?: () => Promise<boolean>
    }

function slugifyScaleId(input: string) {
  // Keep dashes the user types (including trailing) so the field feels natural while editing.
  // Final validation still happens on submit.
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
}

function createClientId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function toUiValues(scale?: ScaleWithUsage | null): BaseValues {
  const visualType = (scale?.visualType as ActivityScaleVisualType) || 'DOT'
  const colorKey = (scale?.colorKey as ActivityScaleColorKey) || 'PURPLE'

  const levels = [...(scale?.levels ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const dotLevels: DotLevel[] = levels.map(l => ({
    id: createClientId(),
    name: l.label || l.value,
  }))
  const gridLevels: GridLevel[] = levels.map(l => ({
    id: createClientId(),
    code: l.value,
    label: l.label,
  }))

  return {
    id: scale?.id ?? '',
    name: scale?.name ?? '',
    description: scale?.description ?? '',
    visualType,
    colorKey,
    dotLevels: dotLevels.length
      ? dotLevels
      : [
          { id: createClientId(), name: 'Beginner' },
          { id: createClientId(), name: 'Intermediate' },
          { id: createClientId(), name: 'Advanced' },
        ],
    gridLevels: gridLevels.length
      ? gridLevels
      : [
          { id: createClientId(), code: 'A1', label: 'Beginner' },
          { id: createClientId(), code: 'A2', label: 'Elementary' },
          { id: createClientId(), code: 'B1', label: 'Intermediate' },
          { id: createClientId(), code: 'B2', label: 'Upper-Intermediate' },
          { id: createClientId(), code: 'C1', label: 'Advanced' },
          { id: createClientId(), code: 'C2', label: 'Mastery' },
        ],
  }
}

function colorPalette(key: ActivityScaleColorKey) {
  switch (key) {
    case 'TEAL':
      return { dot: 'bg-primary-700', chipBg: 'bg-primary-50', chipText: 'text-primary-700' }
    case 'AMBER':
      return { dot: 'bg-warning', chipBg: 'bg-warning-50', chipText: 'text-warning-700' }
    case 'PURPLE':
    default:
      return { dot: 'bg-secondary', chipBg: 'bg-secondary-50', chipText: 'text-secondary' }
  }
}

function colorBorderClass(key: ActivityScaleColorKey) {
  switch (key) {
    case 'TEAL':
      return 'border-primary-700'
    case 'AMBER':
      return 'border-warning'
    case 'PURPLE':
    default:
      return 'border-secondary'
  }
}

function SortableRow({
  id,
  children,
}: {
  id: string
  children: (args: { handleProps: any; rowStyle: React.CSSProperties }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ handleProps: listeners, rowStyle: style })}
    </div>
  )
}

export function CatalogueScaleForm(props: CatalogueScaleFormProps) {
  const { mode, scale, isSaving, isDeleting, onSubmit } = props
  const onDelete = mode === 'edit' ? props.onDelete : undefined
  const { confirm } = useConfirmDialog()

  const initial = useMemo(() => toUiValues(mode === 'edit' ? scale : null), [mode, scale])

  const [id, setId] = useState(initial.id)
  const [name, setName] = useState(initial.name)
  const [description] = useState(initial.description)
  const [visualType, setVisualType] = useState<ActivityScaleVisualType>(initial.visualType)
  const [colorKey, setColorKey] = useState<ActivityScaleColorKey>(initial.colorKey)

  const [dotLevels, setDotLevels] = useState<DotLevel[]>(initial.dotLevels)
  const [gridLevels, setGridLevels] = useState<GridLevel[]>(initial.gridLevels)

  const [errors, setErrors] = useState<{ id?: string; name?: string; levels?: string }>({})

  const userHasEditedIdRef = useRef(false)
  const debouncedId = useDebounce(id, 500)
  const [idError, setIdError] = useState<string | null>(null)
  type IdCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable'
  const [idCheckStatus, setIdCheckStatus] = useState<IdCheckStatus>('idle')

  const palette = colorPalette(colorKey)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const levelsForPayload = useMemo(() => {
    if (visualType === 'DOT') {
      return dotLevels.map(l => ({ value: l.name.trim(), label: l.name.trim() }))
    }
    return gridLevels.map(l => ({
      value: l.code.trim().toUpperCase(),
      label: l.label.trim(),
    }))
  }, [dotLevels, gridLevels, visualType])

  const validate = () => {
    const next: typeof errors = {}
    const trimmedId = id.trim()
    const trimmedName = name.trim()

    if (mode === 'create') {
      if (!trimmedId) next.id = 'Scale ID is required'
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedId)) {
        next.id = 'Scale ID must be lowercase alphanumeric with hyphens only'
      }
    }
    if (!trimmedName) next.name = 'Description is required'
    if (idError) next.id = idError

    const cleanedLevels = levelsForPayload
      .map(l => ({ value: l.value.trim(), label: (l.label ?? '').trim() }))
      .filter(l => l.value)

    if (cleanedLevels.length < 2) next.levels = 'A scale needs at least 2 levels'

    const seen = new Set<string>()
    for (const l of cleanedLevels) {
      const key = l.value.toLowerCase()
      if (seen.has(key)) {
        next.levels = `Duplicate level code/value: "${l.value}"`
        break
      }
      seen.add(key)
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Validate scale ID availability (same UX as category slug)
  useEffect(() => {
    const validateId = async () => {
      if (mode !== 'create') return
      const trimmed = debouncedId.trim()
      if (!trimmed) {
        setIdError(null)
        setIdCheckStatus('idle')
        return
      }

      const idRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!idRegex.test(trimmed)) {
        setIdError('Scale ID must be lowercase alphanumeric with hyphens only')
        setIdCheckStatus('unavailable')
        return
      }

      setIdCheckStatus('checking')
      const res = await catalogueService.checkScaleIdAvailability(trimmed)
      if (res.success && res.data) {
        if (!res.data.available) {
          setIdError('This scale ID is already in use')
          setIdCheckStatus('unavailable')
        } else {
          setIdError(null)
          setIdCheckStatus('available')
        }
      } else {
        setIdCheckStatus('idle')
      }
    }

    void validateId()
  }, [debouncedId, mode])

  const handleSubmit = async () => {
    if (!validate()) return

    if (mode === 'create') {
      const payload: CreateScalePayload = {
        id: id.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        visualType,
        colorKey,
        levels: levelsForPayload,
      }
      await (onSubmit as (p: CreateScalePayload) => Promise<boolean>)(payload)
      return
    }

    const payload: UpdateScalePayload = {
      name: name.trim(),
      description: description.trim() || null,
      visualType,
      colorKey,
      levels: levelsForPayload,
    }
    await (onSubmit as (p: UpdateScalePayload) => Promise<boolean>)(payload)
  }

  const handleDelete = async () => {
    if (!onDelete) return
    const ok = await confirm({
      title: 'Delete scale?',
      message:
        'Deleting this scale will remove it from any activities using it. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    await onDelete()
  }

  const activeLevels = visualType === 'DOT' ? dotLevels : gridLevels

  const handleDotDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return
    setDotLevels(items => {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleGridDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return
    setGridLevels(items => {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  return (
    <form
      id="catalogue-scale-form"
      onSubmit={e => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-5 pt-2">
        <Card className="border border-default-200 shadow-none">
          <CardHeader className="border-b border-default-200 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-default-600">
              Scale details
            </p>
          </CardHeader>
          <CardBody className="gap-4 p-6">
            <Input
              label="Scale ID (slug, must be unique)"
              placeholder="e.g. standard-3"
              value={id}
              onValueChange={val => {
                if (mode === 'edit') return
                userHasEditedIdRef.current = true
                setId(slugifyScaleId(val))
              }}
              isRequired={mode === 'create'}
              isReadOnly={mode === 'edit'}
              isInvalid={!!errors.id || !!idError}
              errorMessage={errors.id || idError}
              description="Stable identifier stored in the database. Never changes after creation."
              classNames={{ input: 'font-mono text-sm' }}
              endContent={
                mode !== 'create' ? null : idCheckStatus === 'checking' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-default-400" />
                ) : idCheckStatus === 'available' ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : idCheckStatus === 'unavailable' && idError ? (
                  <CircleAlert className="h-4 w-4 text-danger" />
                ) : null
              }
            />

            <Input
              label="Description"
              placeholder="e.g. 3-level general skill progression"
              value={name}
              onValueChange={setName}
              isRequired
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              description="Shown to admins in the catalogue. Not visible to providers or parents."
            />
          </CardBody>
        </Card>

        <Card className="border border-default-200 shadow-none">
          <CardHeader className="border-b border-default-200 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-default-600">Scale type</p>
          </CardHeader>
          <CardBody className="flex flex-row gap-3 p-6">
            <button
              type="button"
              onClick={() => setVisualType('DOT')}
              className={cn(
                'cursor-pointer w-full flex flex-col gap-1 text-left rounded-xl border-2 p-4 transition-colors',
                visualType === 'DOT'
                  ? 'border-primary bg-primary-50'
                  : 'border-default-200 hover:border-default-300'
              )}
            >
              <div className="text-lg font-semibold text-default-700 leading-none">●●○</div>
              <div className="text-sm font-semibold text-foreground">Dot progression</div>
              <div className="text-xs text-default-500">
                Levels shown as filled dots. Good for skills with a clear progression.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVisualType('GRID')}
              className={cn(
                'cursor-pointer w-full flex flex-col gap-1 text-left rounded-xl border-2 p-4 transition-colors',
                visualType === 'GRID'
                  ? 'border-primary bg-primary-50'
                  : 'border-default-200 hover:border-default-300'
              )}
            >
              <div className="text-lg font-semibold text-default-700 leading-none font-mono">
                A1 B2
              </div>
              <div className="text-sm font-semibold text-foreground">Label grid</div>
              <div className="text-xs text-default-500">
                Levels shown as chips with a code and name. Used for CEFR and similar frameworks.
              </div>
            </button>
          </CardBody>
        </Card>

        <Card className="border border-default-200 shadow-none">
          <CardHeader className="border-b border-default-200 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-default-600">Color</p>
          </CardHeader>
          <CardBody className="flex flex-row flex-wrap gap-2 p-6">
            {(['PURPLE', 'TEAL', 'AMBER'] as ActivityScaleColorKey[]).map(k => {
              const p = colorPalette(k)
              const selected = colorKey === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setColorKey(k)}
                  className={cn(
                    'cursor-pointer rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors',
                    selected
                      ? cn(colorBorderClass(k), p.chipBg, p.chipText)
                      : 'border-default-200 hover:border-default-300 text-default-700'
                  )}
                >
                  <span className={cn('mr-2 inline-block h-2.5 w-2.5 rounded-full', p.dot)} />
                  {k.charAt(0) + k.slice(1).toLowerCase()}
                </button>
              )
            })}
            <p className="w-full text-xs text-default-500 mt-2">
              Used for dot fill color and chip background.
            </p>
          </CardBody>
        </Card>

        <Card className="border border-default-200 shadow-none">
          <CardHeader className="border-b border-default-200 px-6 py-4">
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-wide text-default-600">Levels</p>
              {errors.levels ? <p className="text-xs text-danger">{errors.levels}</p> : null}
            </div>
          </CardHeader>
          <CardBody className="gap-2 p-6">
            {visualType === 'DOT' ? (
              <>
                <p className="text-xs text-default-500 mb-2">
                  Each level gets one more filled dot. First level = 1 dot.
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDotDragEnd}
                >
                  <SortableContext
                    items={dotLevels.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {dotLevels.map((l, idx) => (
                        <SortableRow key={l.id} id={l.id}>
                          {({ handleProps }) => (
                            <div className="flex items-center gap-2 rounded-xl border border-default-200 bg-default-50 px-3 py-2">
                              <button
                                type="button"
                                className="cursor-grab active:cursor-grabbing"
                                aria-label="Drag to reorder"
                                {...handleProps}
                              >
                                <GripVertical className="h-4 w-4 text-default-400" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-default-400">
                                {idx + 1}
                              </span>
                              <input
                                value={l.name}
                                onChange={e =>
                                  setDotLevels(prev => {
                                    const next = [...prev]
                                    next[idx] = { ...next[idx], name: e.target.value }
                                    return next
                                  })
                                }
                                placeholder="Level name"
                                className="flex-1 bg-transparent text-sm outline-none"
                              />
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() =>
                                  setDotLevels(prev => {
                                    if (prev.length <= 2) return prev
                                    const next = [...prev]
                                    next.splice(idx, 1)
                                    return next
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          )}
                        </SortableRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button
                  size="sm"
                  variant="flat"
                  className="mt-2 w-fit"
                  startContent={<Plus size={14} />}
                  onPress={() =>
                    setDotLevels(prev => [...prev, { id: createClientId(), name: '' }])
                  }
                >
                  Add level
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-default-500 mb-2">
                  Each level has a short code (e.g. A1, B2) and a label (e.g. Beginner).
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleGridDragEnd}
                >
                  <SortableContext
                    items={gridLevels.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {gridLevels.map((l, idx) => (
                        <SortableRow key={l.id} id={l.id}>
                          {({ handleProps }) => (
                            <div className="flex items-center gap-2 rounded-xl border border-default-200 bg-default-50 px-3 py-2">
                              <button
                                type="button"
                                className="cursor-grab active:cursor-grabbing"
                                aria-label="Drag to reorder"
                                {...handleProps}
                              >
                                <GripVertical className="h-4 w-4 text-default-400" />
                              </button>
                              <input
                                value={l.code}
                                onChange={e =>
                                  setGridLevels(prev => {
                                    const next = [...prev]
                                    next[idx] = { ...next[idx], code: e.target.value }
                                    return next
                                  })
                                }
                                placeholder="A1"
                                maxLength={5}
                                className="w-16 rounded-md border border-default-200 bg-white px-2 py-1 text-sm font-mono font-bold outline-none"
                              />
                              <input
                                value={l.label}
                                onChange={e =>
                                  setGridLevels(prev => {
                                    const next = [...prev]
                                    next[idx] = { ...next[idx], label: e.target.value }
                                    return next
                                  })
                                }
                                placeholder="Level name"
                                className="flex-1 bg-transparent text-sm outline-none"
                              />
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() =>
                                  setGridLevels(prev => {
                                    if (prev.length <= 2) return prev
                                    const next = [...prev]
                                    next.splice(idx, 1)
                                    return next
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          )}
                        </SortableRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <Button
                  size="sm"
                  variant="flat"
                  className="mt-2 w-fit"
                  startContent={<Plus size={14} />}
                  onPress={() =>
                    setGridLevels(prev => [...prev, { id: createClientId(), code: '', label: '' }])
                  }
                >
                  Add level
                </Button>
              </>
            )}
          </CardBody>
        </Card>

        {mode === 'edit' && onDelete ? (
          <Card className="border border-danger-200 bg-danger-50/40 shadow-none">
            <CardBody className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-danger">Delete this scale</p>
                <p className="mt-1 text-sm text-default-600">
                  Activities using this scale will have their scale removed. This cannot be undone.
                </p>
              </div>
              <Button
                color="danger"
                variant="flat"
                onPress={() => void handleDelete()}
                isLoading={isDeleting}
                isDisabled={!!isSaving}
              >
                Delete scale
              </Button>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* Right column: live preview */}
      <div className="lg:sticky lg:top-10 lg:self-start">
        <Card className="border border-default-200 shadow-none">
          <CardHeader className="border-b border-default-200 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-default-600">
              Live preview
            </p>
          </CardHeader>
          <CardBody className="p-6">
            <div className="rounded-xl bg-default-50 border border-default-200 p-4">
              <Chip
                size="sm"
                variant="flat"
                className={cn('font-mono', palette.chipBg, palette.chipText)}
              >
                {id.trim() || '—'}
              </Chip>
              <p className="mt-2 text-sm text-default-600">{name.trim() || ' '}</p>

              {visualType === 'DOT' ? (
                <div className="mt-4 space-y-2">
                  {dotLevels.map((l, i) => {
                    const total = dotLevels.length
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {Array.from({ length: total }, (_, j) => {
                            const filled = j <= i
                            return (
                              <span
                                key={j}
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  filled ? palette.dot : 'bg-default-300'
                                )}
                              />
                            )
                          })}
                        </div>
                        <div className="text-xs font-medium text-default-700">{l.name || '…'}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {gridLevels.map((l, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border border-default-200 px-3 py-2 text-center',
                        palette.chipBg
                      )}
                    >
                      <div className={cn('text-sm font-bold font-mono', palette.chipText)}>
                        {(l.code || '?').toUpperCase()}
                      </div>
                      <div className={cn('text-xs mt-0.5', palette.chipText)}>{l.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {mode === 'edit' ? (
                <p className="mt-4 text-xs text-default-400">
                  Used by <strong className="text-default-600">{scale.usedByCount}</strong>{' '}
                  activities
                </p>
              ) : null}
            </div>

            {errors.levels ? (
              <p className="mt-3 text-xs text-danger">{errors.levels}</p>
            ) : activeLevels.length < 2 ? (
              <p className="mt-3 text-xs text-danger">A scale needs at least 2 levels</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="hidden">
        <Button type="submit" isLoading={isSaving} />
      </div>
    </form>
  )
}
