'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { Input } from '@world-schools/ui-web'

import type { CatalogueActivityWithScale, CatalogueScale } from '@/services/catalogue.services'

type Mode = 'add' | 'edit'

export type SkillDraft = { activityId: string; level: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  mode: Mode
  activities: CatalogueActivityWithScale[]
  scales: CatalogueScale[]
  excludedActivityIds?: string[]
  /** Required for edit mode */
  initialSkill?: SkillDraft
  /** Called when the user confirms add/save. */
  onSubmit: (skill: SkillDraft) => void
}

type Step = 1 | 2

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

function sortLevels(scale: CatalogueScale) {
  return [...(scale.levels ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function SkillLevelModal({
  isOpen,
  onClose,
  mode,
  activities,
  scales,
  excludedActivityIds = [],
  initialSkill,
  onSubmit,
}: Props) {
  const isEdit = mode === 'edit'

  const [step, setStep] = useState<Step>(1)
  const [query, setQuery] = useState('')
  const [selectedActivityId, setSelectedActivityId] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    if (isEdit) {
      setStep(2)
      setSelectedActivityId(initialSkill?.activityId ?? '')
      setSelectedLevel(initialSkill?.level ?? '')
    } else {
      setStep(1)
      setSelectedActivityId('')
      setSelectedLevel('')
    }
  }, [isOpen, isEdit, initialSkill?.activityId, initialSkill?.level])

  const availableActivities = useMemo(() => {
    const excluded = new Set(excludedActivityIds)
    return activities.filter(a => !excluded.has(a.id))
  }, [activities, excludedActivityIds])

  const selectedActivity = useMemo(
    () => activities.find(a => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId]
  )

  const selectedScale = useMemo(() => {
    if (!selectedActivity?.scaleId) return null
    return scales.find(s => s.id === selectedActivity.scaleId) ?? null
  }, [scales, selectedActivity?.scaleId])

  const selectedScaleLevels = useMemo(() => {
    if (!selectedScale) return []
    return sortLevels(selectedScale)
  }, [selectedScale])

  const groupedActivities = useMemo(() => {
    const q = normalize(query)
    const filtered = q
      ? availableActivities.filter(a => normalize(a.name).includes(q))
      : availableActivities

    const byCategory = new Map<string, CatalogueActivityWithScale[]>()
    for (const act of filtered) {
      const cat = act.category?.name?.trim() || 'Other'
      const existing = byCategory.get(cat) ?? []
      existing.push(act)
      byCategory.set(cat, existing)
    }

    return [...byCategory.entries()]
      .map(([categoryName, items]) => ({
        categoryName,
        items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [availableActivities, query])

  const title = useMemo(() => {
    if (!isEdit) return step === 1 ? 'Add a skill' : 'Set the level'
    const name = selectedActivity?.name ?? 'Skill'
    return `Edit level · ${name}`
  }, [isEdit, step, selectedActivity?.name])

  const primaryLabel = useMemo(() => {
    if (step === 1) return 'Next'
    return isEdit ? 'Save' : 'Add skill'
  }, [isEdit, step])

  const primaryDisabled = useMemo(() => {
    if (step === 1) return !selectedActivityId
    return !selectedActivityId || !selectedLevel
  }, [selectedActivityId, selectedLevel, step])

  const handlePrimary = () => {
    if (step === 1) {
      if (!selectedActivityId) return
      setStep(2)
      return
    }
    if (!selectedActivityId || !selectedLevel) return
    onSubmit({ activityId: selectedActivityId, level: selectedLevel })
  }

  const renderDots = (total: number, filled: number) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, idx) => (
        <span
          key={idx}
          className={[
            'h-[7px] w-[7px] rounded-full',
            idx < filled ? 'bg-foreground' : 'bg-default-200',
          ].join(' ')}
        />
      ))}
    </div>
  )

  const isCefr = isCefrScale(selectedScale)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">{title}</ModalHeader>
        <ModalBody className="gap-5">
          {!isEdit && (
            <div className="flex gap-2">
              <div
                className={[
                  'h-1 flex-1 rounded-full',
                  step === 1 ? 'bg-foreground' : 'bg-success',
                ].join(' ')}
              />
              <div
                className={[
                  'h-1 flex-1 rounded-full',
                  step === 2 ? 'bg-foreground' : 'bg-default-200',
                ].join(' ')}
              />
            </div>
          )}

          {!isEdit && step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-default-500">Step 1 of 2 — Choose an activity</p>

              <Input
                label="Search activity"
                labelPlacement="outside"
                placeholder="Search activity…"
                value={query}
                onValueChange={setQuery}
              />

              <div className="space-y-4">
                {groupedActivities.map(group => (
                  <div key={group.categoryName}>
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-default-400 mb-2 px-1">
                      {group.categoryName}
                    </div>
                    <div className="space-y-1">
                      {group.items.map(act => {
                        const isSelected = act.id === selectedActivityId
                        const scaleName =
                          act.scaleId && scales.find(s => s.id === act.scaleId)?.name
                            ? scales.find(s => s.id === act.scaleId)!.name
                            : null
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => {
                              setSelectedActivityId(act.id)
                              setSelectedLevel('')
                              // Small delay not required; we can advance immediately.
                              setStep(2)
                            }}
                            className={[
                              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                              isSelected
                                ? 'bg-secondary-50 dark:bg-secondary-900/20'
                                : 'hover:bg-default-100',
                            ].join(' ')}
                          >
                            <span className="text-lg leading-none">{act.emoji ?? '•'}</span>
                            <span className="text-sm text-foreground">{act.name}</span>
                            <span className="ml-auto text-xs text-default-400">
                              {scaleName ?? 'Skill scale'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {groupedActivities.length === 0 && (
                  <p className="text-sm text-default-500">No activities found.</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!isEdit && <p className="text-sm text-default-500">Step 2 of 2 — Set the level</p>}

              <div className="flex items-center gap-3 rounded-lg bg-default-100 px-3 py-3">
                <span className="text-xl leading-none">{selectedActivity?.emoji ?? '•'}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {selectedActivity?.name ?? 'Activity'}
                  </div>
                  <div className="text-xs text-default-500 truncate">
                    {selectedScale?.name ?? 'Scale'}
                  </div>
                </div>
              </div>

              {!selectedScale && (
                <p className="text-sm text-danger">This activity has no scale configured.</p>
              )}

              {!!selectedScale && (
                <>
                  {isCefr ? (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedScaleLevels.map(lvl => {
                        const selected = lvl.value === selectedLevel
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setSelectedLevel(lvl.value)}
                            className={[
                              'rounded-lg border px-3 py-3 text-center transition',
                              selected
                                ? 'border-secondary bg-secondary-50 dark:bg-secondary-900/20'
                                : 'border-default-200 hover:bg-default-100',
                            ].join(' ')}
                          >
                            <div className="text-lg font-semibold text-foreground">{lvl.value}</div>
                            <div className="text-[11px] text-default-500">{lvl.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedScaleLevels.map((lvl, idx) => {
                        const selected = lvl.value === selectedLevel
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setSelectedLevel(lvl.value)}
                            className={[
                              'min-w-[120px] flex-1 rounded-lg border px-3 py-3 text-center transition',
                              selected
                                ? 'border-secondary bg-secondary-50 dark:bg-secondary-900/20'
                                : 'border-default-200 hover:bg-default-100',
                            ].join(' ')}
                          >
                            <div className="flex justify-center mb-1">
                              {renderDots(selectedScaleLevels.length, idx + 1)}
                            </div>
                            <div className="text-xs text-default-600">{lvl.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!isEdit && step === 2 && (
            <Button
              variant="light"
              onPress={() => {
                setStep(1)
                setSelectedLevel('')
              }}
            >
              Back
            </Button>
          )}
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="secondary" onPress={handlePrimary} isDisabled={primaryDisabled}>
            {primaryLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
