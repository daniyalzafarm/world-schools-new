'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { addToast, Button } from '@heroui/react'
import { Pencil, Plus, X } from 'lucide-react'
import { useConfirmDialog } from '@world-schools/ui-web'
import { useChildrenStore } from '@/stores/children-store'
import { childrenService } from '@/services/children.services'
import {
  type CatalogueActivityWithScale,
  type CatalogueCategory,
  type CatalogueScale,
  getActivities,
  getCategoriesForParent,
  getScales,
} from '@/services/catalogue.services'
import { type SkillDraft, SkillLevelModal } from '@/components/children/modals/skill-level-modal'

type InterestItem = { categoryId: string; specificActivityIds: string[] }
type SkillItem = { activityId: string; level: string }

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function isCefrScale(scale: CatalogueScale | null | undefined) {
  if (!scale) return false
  if (normalize(scale.name).includes('cefr')) return true
  const values = scale.levels.map(l => normalize(l.value))
  const cefrSet = new Set(['a1', 'a2', 'b1', 'b2', 'c1', 'c2'])
  return values.length > 0 && values.every(v => cefrSet.has(v))
}

export default function InterestsAndAbilitiesPage() {
  const params = useParams()
  const childId = params.id as string
  const { getChildById } = useChildrenStore()
  const { confirm } = useConfirmDialog()

  const [categories, setCategories] = useState<CatalogueCategory[]>([])
  const [activitiesWithScale, setActivitiesWithScale] = useState<CatalogueActivityWithScale[]>([])
  const [scales, setScales] = useState<CatalogueScale[]>([])
  const [interests, setInterests] = useState<InterestItem[]>([])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSavingInterests, setIsSavingInterests] = useState(false)
  const [interestsSaveStatus, setInterestsSaveStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle')
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [skillModalMode, setSkillModalMode] = useState<'add' | 'edit'>('add')
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null)
  const [mobileTab, setMobileTab] = useState<'interests' | 'skills'>('interests')

  const child = getChildById(childId)
  const childFirstName = child?.firstName ?? 'your child'
  const hasLoadedRef = useRef(false)
  const interestsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedInterestsKeyRef = useRef<string>('')

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const [cats, activitiesRes, scalesRes, interestsRes, skillsRes] = await Promise.all([
        getCategoriesForParent(),
        getActivities(),
        getScales(),
        childrenService.getInterests(childId),
        childrenService.getSkills(childId),
      ])
      setCategories(cats)
      setActivitiesWithScale(activitiesRes)
      setScales(scalesRes)
      const interestData = (interestsRes.data as any)?.data ?? interestsRes.data
      const nextInterests = Array.isArray(interestData) ? interestData : []
      setInterests(nextInterests)
      lastSavedInterestsKeyRef.current = JSON.stringify(nextInterests)
      const skillData = (skillsRes.data as any)?.data ?? skillsRes.data
      setSkills(Array.isArray(skillData) ? skillData : [])
    } catch {
      setInterests([])
      setSkills([])
    } finally {
      setLoading(false)
      hasLoadedRef.current = true
    }
  }, [childId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hasLoadedRef.current) return

    const key = JSON.stringify(interests)
    if (key === lastSavedInterestsKeyRef.current) return

    if (interestsSaveTimerRef.current) clearTimeout(interestsSaveTimerRef.current)
    interestsSaveTimerRef.current = setTimeout(async () => {
      setIsSavingInterests(true)
      setInterestsSaveStatus('saving')
      try {
        const res = await childrenService.updateInterests(childId, interests)
        if (!res.success) {
          throw new Error((res as any).error?.message ?? 'Failed to update interests')
        }
        lastSavedInterestsKeyRef.current = key
        setInterestsSaveStatus('success')
      } catch (e: any) {
        setInterestsSaveStatus('error')
        addToast?.({
          title: 'Save failed',
          description: e?.message ?? 'Failed to update interests',
          color: 'danger',
        })
      } finally {
        setIsSavingInterests(false)
      }
    }, 650)

    return () => {
      if (interestsSaveTimerRef.current) clearTimeout(interestsSaveTimerRef.current)
    }
  }, [childId, interests])

  const toggleInterestCategory = (categorySlug: string, activitySlug?: string) => {
    setInterests(prev => {
      const existing = prev.find(i => i.categoryId === categorySlug)
      if (activitySlug) {
        const ids = existing?.specificActivityIds ?? []
        const has = ids.includes(activitySlug)
        const newIds = has ? ids.filter(s => s !== activitySlug) : [...ids, activitySlug]
        if (!existing && newIds.length > 0) {
          return [...prev, { categoryId: categorySlug, specificActivityIds: newIds }]
        }
        if (existing) {
          // Keep the category selected even if no specifics are selected (matches reference design).
          return prev.map(i =>
            i.categoryId === categorySlug ? { ...i, specificActivityIds: newIds } : i
          )
        }
        return prev
      }
      if (existing) {
        return prev.filter(i => i.categoryId !== categorySlug)
      }
      return [...prev, { categoryId: categorySlug, specificActivityIds: [] }]
    })
  }

  const isInterestSelected = (categorySlug: string, activitySlug?: string) => {
    const item = interests.find(i => i.categoryId === categorySlug)
    if (!item) return false
    if (!activitySlug) return true
    return item.specificActivityIds.includes(activitySlug)
  }

  const anyInterestSelected = interests.length > 0

  const selectedCategoryIds = useMemo(() => new Set(interests.map(i => i.categoryId)), [interests])

  const specificsByCategoryId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of interests) map.set(item.categoryId, item.specificActivityIds ?? [])
    return map
  }, [interests])

  const scaleForActivity = (activityId: string) => {
    const act = activitiesWithScale.find(a => a.id === activityId)
    return act?.scaleId ? (scales.find(s => s.id === act.scaleId) ?? null) : null
  }

  const sortedSkills = useMemo(() => {
    return [...skills].sort((a, b) => {
      const an = activitiesWithScale.find(x => x.id === a.activityId)?.name ?? ''
      const bn = activitiesWithScale.find(x => x.id === b.activityId)?.name ?? ''
      return an.localeCompare(bn)
    })
  }, [skills, activitiesWithScale])

  const saveSkillsOptimistic = async (nextSkills: SkillItem[], prevSkills: SkillItem[]) => {
    setSkills(nextSkills)
    try {
      const res = await childrenService.updateSkills(childId, nextSkills)
      if (!res.success) throw new Error((res as any).error?.message ?? 'Failed to update skills')
      addToast?.({ title: 'Saved', description: 'Skills updated', color: 'success' })
    } catch (e: any) {
      setSkills(prevSkills)
      addToast?.({
        title: 'Save failed',
        description: e?.message ?? 'Failed to update skills',
        color: 'danger',
      })
    }
  }

  const removeSkill = async (activityId: string) => {
    const act = activitiesWithScale.find(a => a.id === activityId)
    const ok = await confirm({
      title: 'Remove skill?',
      message: `This will remove ${act?.name ?? 'this skill'} from ${childFirstName}'s profile.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return

    const prev = skills
    const next = prev.filter(s => s.activityId !== activityId)
    await saveSkillsOptimistic(next, prev)
  }

  const upsertSkill = async (draft: SkillDraft) => {
    const prev = skills
    const exists = prev.some(s => s.activityId === draft.activityId)
    const next = exists
      ? prev.map(s => (s.activityId === draft.activityId ? { ...s, level: draft.level } : s))
      : [...prev, { activityId: draft.activityId, level: draft.level }]
    await saveSkillsOptimistic(next, prev)
  }

  if (!child) {
    return (
      <div className="p-6">
        <p className="text-default-500">Child not found.</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Interests & Abilities</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Helps us match {child.firstName} with the right camps and group {child.firstName} with
          peers at her level.
        </p>
      </div>

      {/* Mobile tabs (reference behavior) */}
      <div className="md:hidden flex border border-default-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileTab('interests')}
          className={[
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            mobileTab === 'interests' ? 'bg-foreground text-background' : 'text-default-600',
          ].join(' ')}
        >
          Interests
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('skills')}
          className={[
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            mobileTab === 'skills' ? 'bg-foreground text-background' : 'text-default-600',
          ].join(' ')}
        >
          Skills
        </button>
      </div>

      {/* ===== INTERESTS SECTION ===== */}
      <section className={mobileTab === 'skills' ? 'hidden md:block' : ''}>
        <div className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-1">Interests</h2>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-default-500">Select what {child.firstName} enjoys.</p>
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span
                className={[
                  'h-2 w-2 rounded-full',
                  interestsSaveStatus === 'saving'
                    ? 'bg-warning'
                    : interestsSaveStatus === 'success'
                      ? 'bg-success'
                      : interestsSaveStatus === 'error'
                        ? 'bg-danger'
                        : 'bg-default-300',
                ].join(' ')}
              />
              <span
                className={[
                  interestsSaveStatus === 'saving'
                    ? 'text-warning'
                    : interestsSaveStatus === 'success'
                      ? 'text-success'
                      : interestsSaveStatus === 'error'
                        ? 'text-danger'
                        : 'text-default-400',
                ].join(' ')}
              >
                {isSavingInterests && 'Saving…'}
                {interestsSaveStatus === 'success' && !isSavingInterests && 'Auto-saved'}
                {interestsSaveStatus === 'error' && 'Unable to save. Changes not synced.'}
                {interestsSaveStatus === 'idle' && 'Auto-save ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-8">
          {categories.map(cat => {
            const id = cat.slug ?? cat.id
            const selected = isInterestSelected(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleInterestCategory(id)}
                className={[
                  'cursor-pointer inline-flex items-center gap-2 rounded-full border-2 bg-background text-sm font-medium text-foreground select-none',
                  selected
                    ? 'border-foreground border-2 px-4 py-2'
                    : 'border-default-200 px-4 py-2.5 hover:border-default-300',
                ].join(' ')}
              >
                <span className="leading-none">{cat.emoji ?? '•'}</span>
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>

        {anyInterestSelected && (
          <div className="mb-14">
            <p className="text-sm text-default-500 mb-5">
              <strong className="text-foreground font-semibold">Get more specific</strong> —
              optional
            </p>

            <div className="space-y-5">
              {categories
                .filter(cat => selectedCategoryIds.has(cat.slug ?? cat.id))
                .map(cat => {
                  const id = cat.slug ?? cat.id
                  const selectedSpecifics = specificsByCategoryId.get(id) ?? []
                  return (
                    <div key={`spec-${id}`}>
                      <div className="text-xs font-semibold tracking-[0.6px] uppercase text-default-400 mb-2.5">
                        {cat.name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(cat.activities ?? []).map(act => {
                          const actId = act.slug ?? act.id
                          const selected = selectedSpecifics.includes(actId)
                          return (
                            <button
                              key={actId}
                              type="button"
                              onClick={() => toggleInterestCategory(id, actId)}
                              className={[
                                'cursor-pointer inline-flex items-center gap-1.5 rounded-full border-2 bg-background text-sm font-normal text-foreground select-none',
                                selected
                                  ? 'border-foreground border-2 px-4 py-2'
                                  : 'border-default-200 px-4 py-2 hover:border-default-300',
                              ].join(' ')}
                            >
                              {act.emoji && <span className="leading-none">{act.emoji}</span>}
                              <span>{act.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </section>

      {/* ===== SKILLS SECTION ===== */}
      <section className={mobileTab === 'interests' ? 'hidden md:block' : ''}>
        <div className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-1">Skills & Levels</h2>
          <p className="text-sm text-default-500">
            Add specific skills and {child.firstName}&apos;s current level. Camps use this to place{' '}
            {child.firstName} in the right group.
          </p>
        </div>

        {sortedSkills.length > 0 && (
          <div className="border border-default-200 rounded-xl overflow-hidden mb-3">
            {sortedSkills.map(s => {
              const act = activitiesWithScale.find(a => a.id === s.activityId)
              const scale = scaleForActivity(s.activityId)
              const levels = [...(scale?.levels ?? [])].sort(
                (a, b) => (a.order ?? 0) - (b.order ?? 0)
              )
              const isCefr = isCefrScale(scale)
              const currentIdx = levels.findIndex(l => l.value === s.level)
              const filled = currentIdx >= 0 ? currentIdx + 1 : 0
              const currentLabel = levels.find(l => l.value === s.level)?.label ?? s.level

              return (
                <div
                  key={s.activityId}
                  className="flex items-center gap-3 px-4 py-4 border-b border-default-200 last:border-b-0"
                >
                  <div className="h-9 w-9 rounded-lg bg-default-100 flex items-center justify-center text-lg shrink-0">
                    {act?.emoji ?? '•'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {act?.name ?? s.activityId}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {isCefr ? (
                        <>
                          <span className="inline-flex items-center px-2 py-px rounded-md border border-default-200 bg-default-100 text-xs font-semibold text-foreground">
                            {s.level}
                          </span>
                          <span className="text-xs text-default-500">{currentLabel}</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: levels.length || 3 }).map((_, idx) => (
                              <span
                                key={idx}
                                className={[
                                  'h-2 w-2 rounded-full',
                                  idx < filled ? 'bg-foreground' : 'bg-default-200',
                                ].join(' ')}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-default-500">{currentLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => {
                        setEditingSkill(s)
                        setSkillModalMode('edit')
                        setSkillModalOpen(true)
                      }}
                      aria-label="Edit level"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="text-danger"
                      onPress={() => void removeSkill(s.activityId)}
                      aria-label="Remove"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Button
          onPress={() => {
            setEditingSkill(null)
            setSkillModalMode('add')
            setSkillModalOpen(true)
          }}
          variant="bordered"
          className="w-full border-dashed"
        >
          <Plus size={16} />
          Add a skill
        </Button>

        <SkillLevelModal
          isOpen={skillModalOpen}
          onClose={() => setSkillModalOpen(false)}
          mode={skillModalMode}
          activities={activitiesWithScale}
          scales={scales}
          excludedActivityIds={skills.map(s => s.activityId)}
          initialSkill={editingSkill ?? undefined}
          onSubmit={draft => {
            void upsertSkill(draft)
            setSkillModalOpen(false)
          }}
        />
      </section>
    </div>
  )
}
