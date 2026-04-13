'use client'

import { type ReactNode, useState } from 'react'
import { MEAL_TYPES, PREDEFINED_DIETARY_OPTIONS } from '@world-schools/wc-frontend-utils'
import { DailySchedule } from './DailySchedule'
import { WeeklySchedule } from './WeeklySchedule'
import type { Camp } from '../../types/camps'
import type { CampBookingAddOn } from '../../types/camp-booking'

const DIETARY_MAP = Object.fromEntries(
  PREDEFINED_DIETARY_OPTIONS.map(o => [o.id, { name: o.name, icon: o.icon }])
)

const MEAL_TYPE_MAP = Object.fromEntries(MEAL_TYPES.map(m => [m.value, m.label]))

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '🥗',
  dinner: '🍽️',
  snacks: '🍎',
  brunch: '🥞',
  afternoon_tea: '🫖',
  supper: '🥣',
}

interface AccordionGroupProps {
  meals?: Camp['meals']
  scheduleType?: Camp['scheduleType']
  dailySchedule?: Camp['dailySchedule']
  weeklySchedule?: Camp['weeklySchedule']
  screenPolicy?: Camp['screenPolicy']
  addOns?: CampBookingAddOn[]
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200 ease-in-out ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="5 8 10 13 15 8" />
    </svg>
  )
}

// ─── Single accordion item ────────────────────────────────────────────────────

function AccordionPanel({
  title,
  children,
  isOpen,
  onToggle,
}: {
  title: string
  children: ReactNode
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 cursor-pointer bg-transparent text-left"
      >
        <h2 className="text-[clamp(18px,3vw,24px)] font-bold text-gray-900 leading-tight">
          {title}
        </h2>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && <div className="pb-7">{children}</div>}
    </div>
  )
}

// ─── Accordion group ──────────────────────────────────────────────────────────

export function AccordionGroup({
  meals,
  scheduleType,
  dailySchedule,
  weeklySchedule,
  screenPolicy,
  addOns,
}: AccordionGroupProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const hasMeals =
    meals &&
    (meals.description ||
      (meals.mealTypes?.length ?? 0) > 0 ||
      (meals.dietaryOptions?.length ?? 0) > 0)
  const hasSchedule =
    scheduleType === 'daily'
      ? !!dailySchedule?.timeSlots?.length
      : scheduleType === 'weekly'
        ? !!weeklySchedule
        : false
  const hasScreenPolicy = !!screenPolicy?.description
  const hasAddOns = (addOns?.length ?? 0) > 0

  if (!hasMeals && !hasSchedule && !hasScreenPolicy && !hasAddOns) return null

  const toggle = (key: string) => setOpenKey(openKey === key ? null : key)

  return (
    <div className="mb-10 md:mb-12 border-t border-gray-200">
      {hasMeals && (
        <AccordionPanel title="Meals" isOpen={openKey === 'meals'} onToggle={() => toggle('meals')}>
          {meals!.description && (
            <p className="text-base text-gray-700 leading-relaxed mb-5">{meals!.description}</p>
          )}

          {/* Dietary option pills */}
          {(meals!.dietaryOptions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {meals!.dietaryOptions!.map((id: string) => {
                const opt = DIETARY_MAP[id]
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium text-gray-700"
                  >
                    {opt?.icon} {opt?.name ?? id}
                  </span>
                )
              })}
            </div>
          )}

          {/* Meal type cards */}
          {(meals!.mealTypes?.length ?? 0) > 0 && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
            >
              {meals!.mealTypes!.map((type: string) => (
                <div key={type} className="border border-gray-100 rounded-xl p-4">
                  <div className="text-xl mb-2">{MEAL_ICONS[type] ?? '🍴'}</div>
                  <div className="text-base font-semibold text-gray-900">
                    {MEAL_TYPE_MAP[type] ?? type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionPanel>
      )}

      {hasSchedule && (
        <AccordionPanel
          title="A day at camp"
          isOpen={openKey === 'schedule'}
          onToggle={() => toggle('schedule')}
        >
          {scheduleType === 'daily' && dailySchedule ? (
            <DailySchedule schedule={dailySchedule.timeSlots} />
          ) : scheduleType === 'weekly' && weeklySchedule ? (
            <WeeklySchedule schedule={weeklySchedule} />
          ) : null}
        </AccordionPanel>
      )}

      {hasScreenPolicy && (
        <AccordionPanel
          title="Screen time policy"
          isOpen={openKey === 'screen-policy'}
          onToggle={() => toggle('screen-policy')}
        >
          <p className="text-base text-gray-700 leading-relaxed">{screenPolicy!.description}</p>
        </AccordionPanel>
      )}

      {hasAddOns && (
        <AccordionPanel
          title="Add-ons & extras"
          isOpen={openKey === 'addons'}
          onToggle={() => toggle('addons')}
        >
          <div className="divide-y divide-gray-100">
            {addOns!.map(addon => (
              <div key={addon.addOnId} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                {addon.icon && <span className="text-xl shrink-0 mt-0.5">{addon.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-gray-900 mb-0.5">{addon.name}</div>
                  {addon.description && (
                    <div className="text-sm text-gray-500 leading-relaxed">{addon.description}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-gray-900">
                    {new Intl.NumberFormat('en-GB', {
                      style: 'currency',
                      currency: addon.currency ?? 'EUR',
                      maximumFractionDigits: 0,
                    }).format(addon.price)}
                  </div>
                  <div className="text-sm text-gray-500">per {addon.quantityUnit ?? 'child'}</div>
                </div>
              </div>
            ))}
          </div>
        </AccordionPanel>
      )}
    </div>
  )
}
