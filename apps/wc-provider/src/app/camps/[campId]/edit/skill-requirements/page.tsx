'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@heroui/react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { AutoSaveIndicator } from '../../../../../components/camp-editor/AutoSaveIndicator'
import { useConfirmDialog } from '@world-schools/ui-web'
import {
  type CampEligibilityItem,
  getCampEligibility,
  putCampEligibility,
} from '../../../../../services/camps.services'
import { useCampsStore } from '../../../../../stores/camps-store'
import {
  type CatalogueActivity,
  type CatalogueScale,
  getActivitiesWithScale,
  getScales,
} from '../../../../../services/catalogue.services'

type UiMode = 'INFO' | 'GATE'

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export default function SkillRequirementsPage() {
  const params = useParams()
  const campId = params.campId as string

  const [items, setItems] = useState<CampEligibilityItem[]>([])
  const [activities, setActivities] = useState<CatalogueActivity[]>([])
  const [scales, setScales] = useState<CatalogueScale[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Modal state (3-step flow)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [mStep, setMStep] = useState<1 | 2 | 3>(1)
  const [mQuery, setMQuery] = useState('')
  const [mActivityId, setMActivityId] = useState<string | null>(null)
  const [mMode, setMMode] = useState<UiMode | null>(null)
  const [mMinLevelValue, setMMinLevelValue] = useState<string | null>(null)

  const autoSaveTimerRef = useRef<number | null>(null)
  const skipNextAutoSaveRef = useRef(true)
  const lastSavedJsonRef = useRef<string>('')

  const { confirm } = useConfirmDialog()

  const load = useCallback(async () => {
    if (!campId) return
    setLoading(true)
    const [eligibilityRes, activitiesRes, scalesRes] = await Promise.all([
      getCampEligibility(campId),
      getActivitiesWithScale(),
      getScales(),
    ])
    const eligibilityItems = eligibilityRes.success ? (eligibilityRes.data.items ?? []) : []
    setItems(eligibilityItems)
    setActivities(activitiesRes ?? [])
    setScales(scalesRes ?? [])
    useCampsStore.setState({ sidebarEligibilityCount: eligibilityItems.length })
    setLoading(false)
  }, [campId])

  useEffect(() => {
    void load()
  }, [load])

  const activityById = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities])
  const scaleById = useMemo(() => new Map(scales.map(s => [s.id, s])), [scales])

  const getActivity = useCallback(
    (activityId: string) => activityById.get(activityId) ?? null,
    [activityById]
  )

  const getScaleForActivity = useCallback(
    (activityId: string) => {
      const act = getActivity(activityId)
      if (!act?.scaleId) return null
      return scaleById.get(act.scaleId) ?? null
    },
    [getActivity, scaleById]
  )

  const getScaleTagText = useCallback(
    (activityId: string) => {
      const scale = getScaleForActivity(activityId)
      if (!scale?.levels?.length) return null
      const first = scale.levels[0]
      const last = scale.levels[scale.levels.length - 1]
      const left = scale.id
      const right = `${first.label} → ${last.label}`
      return `${left} · ${right}`
    },
    [getScaleForActivity]
  )

  const normalizeItemsForSave = useCallback(
    (next: CampEligibilityItem[]) =>
      next.map(i => {
        if ((i.mode as UiMode) === 'INFO') {
          return { ...i, minimumLevelValue: null }
        }
        // Ensure GATE always has a valid minimum level for backend validation.
        const scale = getScaleForActivity(i.activityId)
        const levels = scale?.levels ?? []
        const valid = !!i.minimumLevelValue && levels.some(l => l.value === i.minimumLevelValue)
        const fallback = levels[0]?.value ?? null
        return { ...i, minimumLevelValue: valid ? i.minimumLevelValue : fallback }
      }),
    [getScaleForActivity]
  )

  const saveNow = useCallback(
    async (nextItems: CampEligibilityItem[]) => {
      setSaveStatus('saving')
      const normalized = normalizeItemsForSave(nextItems)
      const res = await putCampEligibility(campId, normalized)
      if (!res.success) {
        setSaveStatus('error')
        return
      }
      const serverItems = res.data.items ?? normalized
      // Avoid a loop where server responds with same data but different order/shape.
      lastSavedJsonRef.current = JSON.stringify(serverItems)
      skipNextAutoSaveRef.current = true
      setItems(serverItems)
      useCampsStore.setState({ sidebarEligibilityCount: serverItems.length })
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 2000)
    },
    [campId, normalizeItemsForSave]
  )

  // Debounced auto-save (auto-save only; no manual Save button)
  useEffect(() => {
    if (loading) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      lastSavedJsonRef.current = JSON.stringify(items)
      return
    }

    const json = JSON.stringify(items)
    if (json === lastSavedJsonRef.current) return

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveNow(items)
    }, 750)

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [items, loading, saveNow])

  const handleRemove = async (activityId: string) => {
    const act = getActivity(activityId)
    const ok = await confirm({
      title: 'Remove skill requirement?',
      message: `This will remove ${act?.name ?? 'this skill'} from the requirements for this camp.\n\nYou can add it again later if needed.`,
      confirmText: 'Remove skill',
      cancelText: 'Keep skill',
      variant: 'danger',
    })
    if (!ok) return
    setItems(prev => prev.filter(i => i.activityId !== activityId))
  }

  const setItemMode = (activityId: string, mode: UiMode) => {
    setItems(prev =>
      prev.map(i => {
        if (i.activityId !== activityId) return i
        if (mode === 'INFO') return { ...i, mode, minimumLevelValue: null }
        const scale = getScaleForActivity(activityId)
        const levels = scale?.levels ?? []
        const fallback = levels[0]?.value ?? null
        return { ...i, mode, minimumLevelValue: i.minimumLevelValue ?? fallback }
      })
    )
  }

  const setItemMinLevel = (activityId: string, minimumLevelValue: string) => {
    setItems(prev => prev.map(i => (i.activityId === activityId ? { ...i, minimumLevelValue } : i)))
  }

  const openModal = () => {
    setAddModalOpen(true)
    setMStep(1)
    setMQuery('')
    setMActivityId(null)
    setMMode(null)
    setMMinLevelValue(null)
  }

  const closeModal = () => {
    setAddModalOpen(false)
  }

  const modalActivity = mActivityId ? getActivity(mActivityId) : null
  const modalScale = mActivityId ? getScaleForActivity(mActivityId) : null

  const canPickActivityIds = useMemo(() => {
    const used = new Set(items.map(i => i.activityId))
    return activities.filter(a => !used.has(a.id))
  }, [activities, items])

  const activitiesByCategory = useMemo(() => {
    const q = mQuery.trim().toLowerCase()
    const list = q
      ? canPickActivityIds.filter(a => a.name.toLowerCase().includes(q))
      : canPickActivityIds

    const byCat = new Map<
      string,
      { key: string; label: string; order: number; items: CatalogueActivity[] }
    >()
    for (const a of list) {
      const key = a.category?.id ?? 'other'
      const label = a.category?.name ?? 'Other'
      const order = a.category?.order ?? 999
      const entry = byCat.get(key) ?? { key, label, order, items: [] }
      entry.items.push(a)
      byCat.set(key, entry)
    }
    return [...byCat.values()]
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map(group => ({
        ...group,
        items: group.items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [canPickActivityIds, mQuery])

  const modalNextLabel = useMemo(() => {
    if (mStep === 3) return 'Add skill'
    if (mStep === 2 && mMode === 'INFO') return 'Add skill'
    return 'Next'
  }, [mMode, mStep])

  const modalNextDisabled = useMemo(() => {
    if (mStep === 1) return !mActivityId
    if (mStep === 2) return !mMode
    if (mStep === 3) return !mMinLevelValue
    return true
  }, [mActivityId, mMode, mMinLevelValue, mStep])

  const addRequirementFromModal = () => {
    if (!mActivityId || !mMode) return
    if (items.some(i => i.activityId === mActivityId)) return

    if (mMode === 'GATE') {
      const scale = getScaleForActivity(mActivityId)
      const levels = scale?.levels ?? []
      const value = mMinLevelValue ?? levels[0]?.value ?? null
      if (!value) return
      if (!levels.some(l => l.value === value)) return
      setItems(prev => [
        ...prev,
        { activityId: mActivityId, mode: 'GATE', minimumLevelValue: value },
      ])
    } else {
      setItems(prev => [
        ...prev,
        { activityId: mActivityId, mode: 'INFO', minimumLevelValue: null },
      ])
    }

    closeModal()
  }

  const modalNext = () => {
    if (mStep === 1) {
      if (!mActivityId) return
      setMStep(2)
      return
    }

    if (mStep === 2) {
      if (!mMode) return
      if (mMode === 'INFO') {
        addRequirementFromModal()
        return
      }
      // Gate mode goes to step 3.
      const scale = modalScale
      const levels = scale?.levels ?? []
      setMMinLevelValue(levels[0]?.value ?? null)
      setMStep(3)
      return
    }

    if (mStep === 3) {
      if (!mMinLevelValue) return
      addRequirementFromModal()
    }
  }

  const modalBack = () => {
    if (mStep === 1) return
    if (mStep === 3) {
      setMStep(2)
      return
    }
    setMStep(1)
  }

  const renderLevelPicker = (opts: {
    scale: CatalogueScale | null
    selectedValue: string | null
    onPick: (value: string) => void
    variant: 'card' | 'modal'
  }) => {
    const { scale, selectedValue, onPick, variant } = opts
    if (!scale) return null
    const levels = scale.levels ?? []
    if (!levels.length) return null

    const isGrid = (scale.visualType ?? '').toUpperCase() === 'GRID'
    if (isGrid) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {levels.map(lvl => (
            <button
              key={lvl.value}
              type="button"
              onClick={() => onPick(lvl.value)}
              className={classNames(
                'cursor-pointer border-2 rounded-lg px-3 py-2 text-center transition',
                selectedValue === lvl.value
                  ? 'border-danger bg-danger-50'
                  : 'border-default-200 hover:border-default-300 hover:bg-default-50'
              )}
            >
              <div className="text-base font-bold leading-5">{lvl.value}</div>
              <div
                className={classNames(
                  'text-xs mt-0.5',
                  selectedValue === lvl.value ? 'text-danger-700 font-semibold' : 'text-default-500'
                )}
              >
                {lvl.label}
              </div>
            </button>
          ))}
        </div>
      )
    }

    // Dots (levels count drives dots count)
    return (
      <div className="flex flex-wrap gap-2">
        {levels.map((lvl, i) => {
          const selected = selectedValue === lvl.value
          return (
            <button
              key={lvl.value}
              type="button"
              onClick={() => onPick(lvl.value)}
              className={classNames(
                'cursor-pointer min-w-20 flex-1 border-2 rounded-lg px-2.5 py-2 text-center transition',
                selected
                  ? 'border-danger bg-danger-50'
                  : 'border-default-200 hover:border-default-300 hover:bg-default-50'
              )}
            >
              <div className="flex justify-center gap-1 mb-1">
                {levels.map((_, j) => (
                  <span
                    key={j}
                    className={classNames(
                      'h-1.5 w-1.5 rounded-full',
                      j <= i ? (selected ? 'bg-danger' : 'bg-default-900') : 'bg-default-200'
                    )}
                  />
                ))}
              </div>
              <div
                className={classNames(
                  'text-xs',
                  selected ? 'text-danger-700 font-semibold' : 'text-default-500'
                )}
              >
                {variant === 'card' ? lvl.label : lvl.label}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-default-500">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-9">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-semibold leading-tight">Skills &amp; Levels Required</h1>
              <AutoSaveIndicator status={saveStatus} />
            </div>
            <p className="text-sm text-default-500 mt-2 leading-6">
              Specify which skills you want to know about or require for enrollment. This helps you
              group participants by level and filter applicants automatically.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {items.map(item => {
          const act = getActivity(item.activityId)
          const scale = getScaleForActivity(item.activityId)
          const tag = getScaleTagText(item.activityId)
          const mode = item.mode as UiMode
          const minLevel = item.minimumLevelValue

          return (
            <div
              key={item.activityId}
              className="border border-default-200 rounded-xl bg-background overflow-hidden hover:border-default-300 transition"
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-default-200">
                <div className="h-9 w-9 rounded-lg bg-default-100 flex items-center justify-center text-lg shrink-0">
                  {act?.emoji ?? '⭐'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">
                    {act?.name ?? item.activityId}
                  </div>
                  {tag && (
                    <span className="inline-flex mt-0.5 px-2 py-px rounded border border-default-200 bg-default-50 text-xs text-default-500 font-medium">
                      {tag}
                    </span>
                  )}
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => handleRemove(item.activityId)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>

              <div className="px-4 py-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setItemMode(item.activityId, 'INFO')}
                    className={classNames(
                      'cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition text-left',
                      mode === 'INFO'
                        ? 'border-primary bg-primary-50'
                        : 'border-default-200 hover:border-default-300 hover:bg-default-50'
                    )}
                  >
                    <span
                      className={classNames(
                        'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center',
                        mode === 'INFO' ? 'border-primary-700' : 'border-default-300'
                      )}
                    >
                      <span
                        className={classNames(
                          'h-2 w-2 rounded-full',
                          mode === 'INFO' ? 'bg-primary-700' : 'hidden'
                        )}
                      />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={classNames(
                          'text-sm font-semibold',
                          mode === 'INFO' ? 'text-primary-800' : 'text-default-900'
                        )}
                      >
                        Required before camp
                      </span>
                      <span className="text-xs text-default-500 leading-4">
                        All levels welcome, info collected post-confirmation
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemMode(item.activityId, 'GATE')}
                    className={classNames(
                      'cursor-pointer flex items-start gap-2.5 p-3 rounded-xl border-2 transition text-left',
                      mode === 'GATE'
                        ? 'border-danger bg-danger-50'
                        : 'border-default-200 hover:border-default-300 hover:bg-default-50'
                    )}
                  >
                    <span
                      className={classNames(
                        'mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center',
                        mode === 'GATE' ? 'border-danger' : 'border-default-300'
                      )}
                    >
                      <span
                        className={classNames(
                          'h-2 w-2 rounded-full',
                          mode === 'GATE' ? 'bg-danger' : 'hidden'
                        )}
                      />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={classNames(
                          'text-sm font-semibold',
                          mode === 'GATE' ? 'text-danger-700' : 'text-default-900'
                        )}
                      >
                        Required to book
                      </span>
                      <span className="text-xs text-default-500 leading-4">
                        Child can&apos;t book if level too low
                      </span>
                    </span>
                  </button>
                </div>

                {mode === 'GATE' ? (
                  <div className="border-t border-default-200 pt-4 mt-1">
                    <div className="text-xs font-semibold text-default-500 tracking-wide uppercase mb-2.5">
                      Minimum required level
                    </div>
                    {renderLevelPicker({
                      scale,
                      selectedValue: minLevel,
                      onPick: v => setItemMinLevel(item.activityId, v),
                      variant: 'card',
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-primary-800 bg-primary-50 rounded-lg px-3 py-2">
                    All levels welcome. Parents will be asked for this info after the booking is
                    confirmed.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Button onPress={openModal} variant="bordered" className="w-full border-dashed">
        <Plus size={16} />
        Add a required skill
      </Button>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-content1 rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-default-200">
              <div className="text-base font-semibold">
                {mStep === 1
                  ? 'Add a required skill'
                  : mStep === 2
                    ? 'Choose a mode'
                    : 'Set the minimum level'}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="h-8 w-8 rounded-full flex items-center justify-center text-default-500 hover:bg-default-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="flex gap-2 mb-5">
                <div
                  className={classNames(
                    'h-1 flex-1 rounded',
                    mStep >= 1 ? 'bg-default-900' : 'bg-default-200'
                  )}
                />
                <div
                  className={classNames(
                    'h-1 flex-1 rounded',
                    mStep >= 2 ? 'bg-default-900' : 'bg-default-200'
                  )}
                />
                <div
                  className={classNames(
                    'h-1 flex-1 rounded',
                    mStep === 3 ? 'bg-default-900' : 'bg-default-200'
                  )}
                />
              </div>

              {mStep === 1 && (
                <div>
                  <p className="text-sm text-default-500 mb-4">Step 1 of 3 — Choose an activity</p>
                  <div className="relative mb-4">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-default-400">
                      <Search size={16} />
                    </span>
                    <input
                      value={mQuery}
                      onChange={e => setMQuery(e.target.value)}
                      placeholder="Search activity…"
                      className="w-full h-11 pl-10 pr-3 rounded-lg border border-default-300 bg-background text-sm focus:outline-none focus:border-default-900"
                    />
                  </div>

                  <div className="max-h-[46vh] overflow-auto pr-1">
                    {activitiesByCategory.map(group => (
                      <div key={group.key} className="mb-2">
                        <div className="text-xs font-semibold tracking-wide uppercase text-default-400 px-1 pb-1">
                          {group.label}
                        </div>
                        {group.items.map(a => {
                          const selected = mActivityId === a.id
                          const scale = a.scaleId ? (scaleById.get(a.scaleId) ?? null) : null
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setMActivityId(a.id)
                                setMMode(null)
                                setMMinLevelValue(null)
                              }}
                              className={classNames(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left',
                                selected ? 'bg-primary-50' : 'hover:bg-default-50'
                              )}
                            >
                              <span className="text-lg">{a.emoji ?? '⭐'}</span>
                              <span className="text-sm">{a.name}</span>
                              <span className="ml-auto text-xs text-default-400">
                                {scale?.id ?? a.scaleId ?? ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    {activitiesByCategory.length === 0 && (
                      <p className="text-sm text-default-500">No activities found.</p>
                    )}
                  </div>
                </div>
              )}

              {mStep === 2 && modalActivity && (
                <div>
                  <p className="text-sm text-default-500 mb-4">Step 2 of 3 — Choose a mode</p>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50 mb-5">
                    <span className="text-xl">{modalActivity.emoji ?? '⭐'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{modalActivity.name}</div>
                      <div className="text-xs text-default-500">
                        {getScaleTagText(modalActivity.id)}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-medium mb-2.5">
                    How do you want to use this skill?
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMMode('INFO')}
                      className={classNames(
                        'flex items-start gap-3 p-4 rounded-xl border-2 transition text-left',
                        mMode === 'INFO'
                          ? 'border-primary bg-primary-50'
                          : 'border-default-200 hover:border-default-300'
                      )}
                    >
                      <span
                        className={classNames(
                          'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                          mMode === 'INFO' ? 'border-primary-700' : 'border-default-300'
                        )}
                      >
                        <span
                          className={classNames(
                            'h-2 w-2 rounded-full',
                            mMode === 'INFO' ? 'bg-primary-700' : 'hidden'
                          )}
                        />
                      </span>
                      <span>
                        <div className="text-sm font-semibold mb-0.5">Required before camp</div>
                        <div className="text-xs text-default-500">
                          All levels welcome. Info is collected after the booking is confirmed.
                        </div>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMMode('GATE')}
                      className={classNames(
                        'flex items-start gap-3 p-4 rounded-xl border-2 transition text-left',
                        mMode === 'GATE'
                          ? 'border-danger bg-danger-50'
                          : 'border-default-200 hover:border-default-300'
                      )}
                    >
                      <span
                        className={classNames(
                          'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                          mMode === 'GATE' ? 'border-danger' : 'border-default-300'
                        )}
                      >
                        <span
                          className={classNames(
                            'h-2 w-2 rounded-full',
                            mMode === 'GATE' ? 'bg-danger' : 'hidden'
                          )}
                        />
                      </span>
                      <span>
                        <div className="text-sm font-semibold mb-0.5">Required to book</div>
                        <div className="text-xs text-default-500">
                          Set a minimum level. Children below it can&apos;t send a booking request.
                        </div>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {mStep === 3 && modalActivity && modalScale && (
                <div>
                  <p className="text-sm text-default-500 mb-4">
                    Step 3 of 3 — Set the minimum level
                  </p>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-default-50 mb-5">
                    <span className="text-xl">{modalActivity.emoji ?? '⭐'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{modalActivity.name}</div>
                      <div className="text-xs text-default-500">
                        {getScaleTagText(modalActivity.id)}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-default-500 mb-2.5">
                    Minimum required level
                  </div>
                  {renderLevelPicker({
                    scale: modalScale,
                    selectedValue: mMinLevelValue,
                    onPick: v => setMMinLevelValue(v),
                    variant: 'modal',
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-default-200">
              {mStep > 1 && (
                <Button variant="flat" onPress={modalBack}>
                  Back
                </Button>
              )}
              <Button variant="flat" onPress={closeModal}>
                Cancel
              </Button>
              <Button color="primary" onPress={modalNext} isDisabled={modalNextDisabled}>
                {modalNextLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
