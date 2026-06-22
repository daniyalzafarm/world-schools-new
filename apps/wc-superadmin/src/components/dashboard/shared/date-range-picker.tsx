'use client'

import {
  Button,
  ButtonGroup,
  type DateValue,
  DateRangePicker as HeroDateRangePicker,
  type RangeValue,
} from '@heroui/react'
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import type { DashboardRange, DashboardRangePreset } from '@/types/analytics'

interface DateRangePickerProps {
  value: DashboardRange
  onChange: (range: DashboardRange) => void
  className?: string
}

const PRESETS: { key: Exclude<DashboardRangePreset, 'custom'>; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '1y', label: '1Y' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: DateValue) => `${d.year}-${pad(d.month)}-${pad(d.day)}`

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const pickerValue: RangeValue<DateValue> | null =
    value.preset === 'custom' && value.from && value.to
      ? { start: parseDate(value.from.slice(0, 10)), end: parseDate(value.to.slice(0, 10)) }
      : null

  const handlePickerChange = (range: RangeValue<DateValue> | null) => {
    if (!range?.start || !range?.end) return
    // Start-of-day / end-of-day keeps the end date inclusive and guarantees
    // from < to even for a single-day selection (backend rejects from >= to).
    onChange({
      preset: 'custom',
      from: `${fmt(range.start)}T00:00:00`,
      to: `${fmt(range.end)}T23:59:59`,
    })
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <ButtonGroup size="sm" variant="flat">
        {PRESETS.map(p => (
          <Button
            key={p.key}
            color={value.preset === p.key ? 'primary' : 'default'}
            variant={value.preset === p.key ? 'solid' : 'flat'}
            onPress={() => onChange({ preset: p.key })}
            className="h-9 min-w-12"
          >
            {p.label}
          </Button>
        ))}
      </ButtonGroup>
      <HeroDateRangePicker
        aria-label="Custom date range"
        size="sm"
        variant="flat"
        maxValue={today(getLocalTimeZone())}
        value={pickerValue}
        onChange={handlePickerChange}
        classNames={{ base: 'w-auto', inputWrapper: 'h-9 min-w-[232px]' }}
      />
    </div>
  )
}
