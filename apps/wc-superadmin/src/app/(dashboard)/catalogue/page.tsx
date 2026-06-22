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
  Spinner,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from '@heroui/react'
import { ChevronDown, FolderOpen, Info, Layers, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  type AdminActivity,
  type AdminCategory,
  catalogueService,
  type ScaleWithUsage,
} from '@/services/catalogue.services'
import { cn, useConfirmDialog } from '@world-schools/ui-web'
import { Can } from '@/components/auth/can'

const CATALOGUE_INFO_BANNER_DISMISSED_KEY = 'wc_superadmin_catalogue_info_banner_dismissed'

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
  const [showInfoBanner, setShowInfoBanner] = useState(false)
  const { confirm } = useConfirmDialog()

  useEffect(() => {
    if (localStorage.getItem(CATALOGUE_INFO_BANNER_DISMISSED_KEY) !== 'true') {
      setShowInfoBanner(true)
    }
  }, [])

  const handleDismissInfoBanner = () => {
    setShowInfoBanner(false)
    localStorage.setItem(CATALOGUE_INFO_BANNER_DISMISSED_KEY, 'true')
  }

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
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Activity Catalogue
            </h1>
            <p className="text-default-600 mt-1">
              Manage interest categories and skill scales — single source of truth for parent,
              provider and camp pages
            </p>
          </div>
        </header>

        {showInfoBanner && (
          <div className="relative flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900/40 dark:bg-primary-900/10">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="flex-1 pr-8">
              <div className="text-sm font-semibold text-default-900">
                How catalogue items surface
              </div>
              <div className="mt-1 text-sm text-default-500 leading-normal">
                Active categories appear simultaneously in three places — the{' '}
                <strong>parent&apos;s child interest picker</strong>, the{' '}
                <strong>camp&apos;s &quot;interests covered&quot; section</strong>, and the{' '}
                <strong>camp focus selector</strong>. Toggle a category to Draft to hide it from
                parents and providers until it&apos;s ready to launch.
              </div>
            </div>
            <Button
              isIconOnly
              onPress={handleDismissInfoBanner}
              aria-label="Dismiss"
              size="sm"
              variant="flat"
              radius="full"
              color="primary"
            >
              <X className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </Button>
          </div>
        )}

        <Card>
          <CardBody className="p-0">
            <div className="border-b border-default-200 px-4 pt-2">
              <Tabs
                aria-label="Catalogue sections"
                selectedKey={tab}
                onSelectionChange={key => setTab(key as 'categories' | 'scales')}
                variant="underlined"
                classNames={{ base: 'w-full', tabList: 'p-0!' }}
              >
                <Tab key="categories" title="Interest Categories" />
                <Tab key="scales" title="Skill Scales" />
              </Tabs>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-default-200 px-4 py-3">
              {tab === 'categories' ? (
                <>
                  <p className="text-sm text-default-500">
                    {activeCount} active · {draftCount} draft · Expand a row to manage activities
                  </p>
                  <Can permission="catalogue.create">
                    <Button
                      color="primary"
                      className="ml-auto shrink-0"
                      startContent={<Plus className="h-5 w-5" />}
                      onPress={() => router.push('/catalogue/categories/create')}
                    >
                      Add Category
                    </Button>
                  </Can>
                </>
              ) : (
                <>
                  <p className="text-sm text-default-500">
                    Level progressions used for child skill profiles and camp eligibility
                    requirements
                  </p>
                  <Can permission="catalogue.create">
                    <Button
                      color="primary"
                      className="ml-auto shrink-0"
                      startContent={<Plus className="h-5 w-5" />}
                      onPress={() => router.push('/catalogue/scales/create')}
                    >
                      Add Scale
                    </Button>
                  </Can>
                </>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Spinner size="lg" label="Loading catalogue" />
              </div>
            ) : tab === 'categories' ? (
              categories.length === 0 ? (
                <div className="m-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-default-300 px-6 py-16 text-center">
                  <FolderOpen className="h-10 w-10 text-default-400" />
                  <div>
                    <div className="text-base font-semibold text-default-900">
                      No categories yet
                    </div>
                    <p className="mt-1 max-w-md text-sm text-default-500">
                      Create your first interest category to organize activities by theme.
                    </p>
                  </div>
                  <Can permission="catalogue.create">
                    <Button
                      color="primary"
                      startContent={<Plus className="h-4 w-4" />}
                      onPress={() => router.push('/catalogue/categories/create')}
                    >
                      Create Your First Category
                    </Button>
                  </Can>
                </div>
              ) : (
                <ul className="divide-y divide-default-200">
                  {categories.map(cat => {
                    const isExpanded = expandedId === cat.id
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          className={cn(
                            'cursor-pointer w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-default-50 transition-colors',
                            cat.status === 'DRAFT' && 'bg-default-50/50'
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
                          <Can permission="catalogue.update">
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
                          </Can>
                          <ChevronDown
                            size={20}
                            className={cn(
                              'text-default-400 transition-transform',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <div className="border-t border-default-200 bg-default-50/40 px-4 pb-4 pt-2">
                            <Table aria-label="Activities" removeWrapper>
                              <TableHeader>
                                <TableColumn
                                  key="activity"
                                  className="text-xs font-semibold uppercase tracking-wide text-default-500"
                                >
                                  Activity
                                </TableColumn>
                                <TableColumn
                                  key="scale"
                                  className="text-xs font-semibold uppercase tracking-wide text-default-500"
                                >
                                  Scale
                                </TableColumn>
                                <TableColumn
                                  key="actions"
                                  className="text-xs font-semibold uppercase tracking-wide text-default-500"
                                >
                                  Actions
                                </TableColumn>
                              </TableHeader>
                              <TableBody
                                items={cat.activities ?? []}
                                emptyContent={
                                  <div className="py-6 text-center text-sm text-default-500">
                                    No activities in this category yet.
                                  </div>
                                }
                              >
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
                                        <Can permission="catalogue.update">
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
                                        </Can>
                                        <Can permission="catalogue.delete">
                                          <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="danger"
                                            onPress={() => handleDeleteActivity(act)}
                                          >
                                            <Trash2 size={14} />
                                          </Button>
                                        </Can>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Can permission="catalogue.create">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  startContent={<Plus size={14} />}
                                  onPress={() =>
                                    router.push(`/catalogue/activities/create?categoryId=${cat.id}`)
                                  }
                                >
                                  Add activity
                                </Button>
                              </Can>
                              <Can permission="catalogue.delete">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="danger"
                                  startContent={<Trash2 size={14} />}
                                  onPress={() => handleDeleteCategory(cat)}
                                >
                                  Delete category
                                </Button>
                              </Can>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
            ) : scales.length === 0 ? (
              <div className="m-4 flex flex-col items-center gap-4 rounded-xl border border-dashed border-default-300 px-6 py-16 text-center">
                <Layers className="h-10 w-10 text-default-400" />
                <div>
                  <div className="text-base font-semibold text-default-900">
                    No skill scales yet
                  </div>
                  <p className="mt-1 max-w-md text-sm text-default-500">
                    Create level progressions to use across child skill profiles and camp
                    eligibility requirements.
                  </p>
                </div>
                <Can permission="catalogue.create">
                  <Button
                    color="primary"
                    startContent={<Plus className="h-4 w-4" />}
                    onPress={() => router.push('/catalogue/scales/create')}
                  >
                    Create Your First Scale
                  </Button>
                </Can>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
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
                        <Can permission="catalogue.update">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => router.push(`/catalogue/scales/${scale.id}/edit`)}
                          >
                            <Pencil size={16} />
                          </Button>
                        </Can>
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

                      <p className="mt-4 text-xs text-default-500">
                        Used by <strong className="text-default-700">{scale.usedByCount}</strong>{' '}
                        activities
                      </p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
