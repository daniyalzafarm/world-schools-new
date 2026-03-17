'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageSlot } from '@/components/layout/page-slot'
import { useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  type AdminActivity,
  type AdminCategory,
  catalogueService,
  type ScaleWithUsage,
} from '@/services/catalogue.services'
import { cn, useConfirmDialog } from '@world-schools/ui-web'

function getApiErrorMessage(result: unknown, fallback: string) {
  const maybe: any = result
  return maybe?.data?.message ?? fallback
}

function getScaleDotColorClass(colorKey?: string) {
  if (colorKey === 'TEAL') return 'bg-primary'
  if (colorKey === 'AMBER') return 'bg-warning'
  return 'bg-secondary'
}

function getScaleChipClasses(colorKey?: string) {
  if (colorKey === 'TEAL') return 'bg-primary-50 text-primary-700'
  if (colorKey === 'AMBER') return 'bg-warning-50 text-warning-700'
  return 'bg-secondary-50 text-secondary'
}

export default function CataloguePage() {
  const router = useRouter()
  const [tab, setTab] = useState<'categories' | 'scales'>('categories')
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [scales, setScales] = useState<ScaleWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { confirm } = useConfirmDialog()

  const loadCategories = useCallback(async () => {
    const res = await catalogueService.getCategories()
    if (res.success && res.data) setCategories(Array.isArray(res.data) ? res.data : [])
    else setCategories([])
  }, [])

  const loadScales = useCallback(async () => {
    const res = await catalogueService.getScales()
    if (res.success && res.data) setScales(Array.isArray(res.data) ? res.data : [])
    else setScales([])
  }, [])

  useEffect(() => {
    setLoading(true)
    void Promise.all([loadCategories(), loadScales()]).finally(() => setLoading(false))
  }, [loadCategories, loadScales])

  const handleToggleStatus = async (cat: AdminCategory) => {
    const next = cat.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE'

    const ok = await confirm({
      title: 'Change category status?',
      message:
        next === 'ACTIVE'
          ? `Activate "${cat.name}"? This will make it visible to parents and providers.`
          : `Set "${cat.name}" to Draft? This will hide it from parents and providers until it's active.`,
      confirmText: next === 'ACTIVE' ? 'Activate' : 'Set to Draft',
      cancelText: 'Cancel',
      variant: next === 'ACTIVE' ? 'info' : 'warning',
    })
    if (!ok) return

    const res = await catalogueService.updateCategory(cat.id, {
      status: next as 'ACTIVE' | 'DRAFT',
    })
    if (res.success) {
      setCategories(prev =>
        prev.map(c => {
          if (c.id !== cat.id) return c
          if (res.data) return { ...c, ...res.data }
          return { ...c, status: next as 'ACTIVE' | 'DRAFT' }
        })
      )
      addToast({
        title: next === 'ACTIVE' ? 'Category activated' : 'Category set to Draft',
        color: 'success',
      })
    } else {
      addToast({ title: getApiErrorMessage(res, 'Update failed'), color: 'danger' })
    }
  }

  const handleDeleteCategory = async (cat: AdminCategory) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: `Remove "${cat.name}"? This will fail if any child or camp data references it.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    const res = await catalogueService.deleteCategory(cat.id)
    if (res.success) {
      await loadCategories()
      setExpandedId(prev => (prev === cat.id ? null : prev))
      addToast({ title: 'Category deleted', color: 'success' })
    } else {
      addToast({
        title: getApiErrorMessage(res, 'Delete failed (may be in use)'),
        color: 'danger',
      })
    }
  }

  const handleDeleteActivity = async (activity: AdminActivity) => {
    const ok = await confirm({
      title: 'Delete activity?',
      message: `Remove "${activity.name}"? This will fail if used in skills or eligibility.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    const res = await catalogueService.deleteActivity(activity.id)
    if (res.success) {
      await loadCategories()
      addToast({ title: 'Activity deleted', color: 'success' })
    } else {
      addToast({ title: getApiErrorMessage(res, 'Delete failed'), color: 'danger' })
    }
  }

  const activeCount = categories.filter(c => c.status === 'ACTIVE').length
  const draftCount = categories.filter(c => c.status === 'DRAFT').length

  return (
    <PageSlot className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-default-900">Activity Catalogue</h1>
        <p className="text-sm text-default-500 mt-1">
          Manage interest categories and skill scales — single source of truth for parent, provider
          and camp pages
        </p>
      </div>

      <Card className="border border-primary-200 bg-primary-50 shadow-none">
        <CardBody className="py-3">
          <div className="flex items-start gap-3 text-sm text-default-900 leading-relaxed">
            <span className="text-base leading-none mt-0.5" aria-hidden="true">
              💡
            </span>
            <div>
              <strong>How this works:</strong> Active categories appear simultaneously in three
              places — the <strong>parent&apos;s child interest picker</strong>, the{' '}
              <strong>camp&apos;s &quot;interests covered&quot; section</strong>, and the{' '}
              <strong>camp focus selector</strong>. Toggle a category to Draft to hide it from
              parents and providers until it&apos;s ready to launch.
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex gap-0 border-b border-default-200">
          <button
            type="button"
            onClick={() => setTab('categories')}
            className={cn(
              'cursor-pointer px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === 'categories'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-default-500 hover:text-default-700'
            )}
          >
            Interest Categories
          </button>
          <button
            type="button"
            onClick={() => setTab('scales')}
            className={cn(
              'cursor-pointer px-5 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === 'scales'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-default-500 hover:text-default-700'
            )}
          >
            Skill Scales
          </button>
        </div>

        {loading ? (
          <p className="text-default-500">Loading…</p>
        ) : tab === 'categories' ? (
          <>
            <div className="flex items-center justify-between">
              <div className="gap-2">
                <p className="font-bold">Interest Categories</p>
                <p className="text-sm text-default-500">
                  {activeCount} active · {draftCount} draft · Expand a row to manage activities
                </p>
              </div>
              <Button
                color="primary"
                startContent={<Plus size={18} />}
                onPress={() => router.push('/catalogue/categories/create')}
              >
                Add Category
              </Button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <Card
                  key={cat.id}
                  className="overflow-hidden shadow-none border border-default-200 rounded-lg"
                >
                  <CardBody className="p-0">
                    <button
                      type="button"
                      className={cn(
                        'cursor-pointer w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-default-100 transition-colors',
                        cat.status === 'DRAFT' && 'bg-default-50'
                      )}
                      onClick={() => setExpandedId(prev => (prev === cat.id ? null : cat.id))}
                    >
                      <span className="text-2xl shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-default-200">
                        {cat.emoji ?? '📁'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-default-900">{cat.name}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-default-500 mt-0.5">
                          <span>{cat.activities?.length ?? 0} activities</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Chip
                              size="sm"
                              variant="flat"
                              className={cn(
                                'h-6 px-2 text-xs',
                                cat.surfaceParentInterests
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'bg-default-200 text-default-500 line-through',
                                cat.status === 'DRAFT' && 'bg-default-200 text-default-500'
                              )}
                            >
                              👶 Parent interests
                            </Chip>
                            <Chip
                              size="sm"
                              variant="flat"
                              className={cn(
                                'h-6 px-2 text-xs',
                                cat.surfaceCampFocus
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'bg-default-200 text-default-500 line-through',
                                cat.status === 'DRAFT' && 'bg-default-200 text-default-500'
                              )}
                            >
                              🎯 Camp focus
                            </Chip>
                            <Chip
                              size="sm"
                              variant="flat"
                              className={cn(
                                'h-6 px-2 text-xs',
                                cat.surfaceCampInterests
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'bg-default-200 text-default-500 line-through',
                                cat.status === 'DRAFT' && 'bg-default-200 text-default-500'
                              )}
                            >
                              🏕️ Camp interests
                            </Chip>
                          </div>
                        </div>
                      </div>
                      {cat.status === 'ACTIVE' ? (
                        <Chip
                          size="sm"
                          color="success"
                          variant="flat"
                          classNames={{
                            base: 'bg-primary-50 text-primary-700',
                            content: 'flex items-center gap-1 bg-primary-50 text-primary-700',
                          }}
                        >
                          <div className="w-2 h-2 rounded-full bg-primary-700" />
                          {cat.status}
                        </Chip>
                      ) : (
                        <Chip size="sm" color="default" variant="flat">
                          {cat.status}
                        </Chip>
                      )}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => router.push(`/catalogue/categories/${cat.id}/edit`)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Switch
                        size="sm"
                        isSelected={cat.status === 'ACTIVE'}
                        onValueChange={() => handleToggleStatus(cat)}
                      />
                      <ChevronDown
                        size={20}
                        className={cn(
                          'text-default-400 transition-transform',
                          expandedId === cat.id && 'rotate-180'
                        )}
                      />
                    </button>
                    {expandedId === cat.id && (
                      <div className="border-t border-default-200 px-4 pb-4 pt-2">
                        <Table aria-label="Activities" removeWrapper>
                          <TableHeader>
                            <TableColumn key="activity">Activity</TableColumn>
                            <TableColumn key="scale">Scale</TableColumn>
                            <TableColumn key="actions">Actions</TableColumn>
                          </TableHeader>
                          <TableBody items={cat.activities ?? []}>
                            {(act: AdminActivity) => (
                              <TableRow key={act.id}>
                                <TableCell>
                                  <span className="mr-2">{act.emoji ?? '•'}</span>
                                  {act.name}
                                </TableCell>
                                <TableCell>
                                  {act.scaleId ? (
                                    <Chip size="sm" variant="flat" color="secondary">
                                      {act.scaleId}
                                    </Chip>
                                  ) : (
                                    <span className="text-default-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-start gap-1">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() =>
                                        router.push(`/catalogue/activities/${act.id}/edit`)
                                      }
                                    >
                                      <Pencil size={14} />
                                    </Button>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      onPress={() => handleDeleteActivity(act)}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="mt-2"
                            startContent={<Plus size={14} />}
                            onPress={() =>
                              router.push(`/catalogue/activities/create?categoryId=${cat.id}`)
                            }
                          >
                            Add activity
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            className="mt-2 ml-2"
                            onPress={() => handleDeleteCategory(cat)}
                          >
                            Delete category
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="gap-2">
                <p className="font-bold">Skill Scales</p>
                <p className="text-sm text-default-500">
                  Level progressions used for child skill profiles and camp eligibility requirements
                </p>
              </div>
              <Button
                color="primary"
                startContent={<Plus size={18} />}
                onPress={() => router.push('/catalogue/scales/create')}
              >
                Add Scale
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scales.map(scale => (
                <Card key={scale.id} className="border border-default-200 shadow-none">
                  <CardBody className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Chip
                          size="sm"
                          variant="flat"
                          className={cn('font-mono', getScaleChipClasses(scale.colorKey))}
                        >
                          {scale.id}
                        </Chip>
                        <p className="mt-2 text-sm text-default-500">{scale.name}</p>
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => router.push(`/catalogue/scales/${scale.id}/edit`)}
                      >
                        <Pencil size={16} />
                      </Button>
                    </div>

                    <div className="mt-4">
                      {scale.visualType === 'GRID' ? (
                        <div className="flex flex-wrap gap-1.5">
                          {scale.levels?.map(lvl => (
                            <Chip
                              key={lvl.id}
                              size="sm"
                              variant="flat"
                              className={cn('font-mono', getScaleChipClasses(scale.colorKey))}
                            >
                              {lvl.value}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {scale.levels?.map((lvl, idx) => (
                            <div key={lvl.id} className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {Array.from({ length: scale.levels.length }, (_, j) => (
                                  <span
                                    key={j}
                                    className={cn(
                                      'h-2 w-2 rounded-full',
                                      j <= idx
                                        ? getScaleDotColorClass(scale.colorKey)
                                        : 'bg-default-300'
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
                    </div>

                    <p className="mt-4 text-xs text-default-400">
                      Used by <strong className="text-default-600">{scale.usedByCount}</strong>{' '}
                      activities
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </PageSlot>
  )
}
