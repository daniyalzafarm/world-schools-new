'use client'

import { Button, ButtonGroup } from '@heroui/react'
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

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  return (
    <ButtonGroup size="sm" variant="flat" className={className}>
      {PRESETS.map(p => (
        <Button
          key={p.key}
          color={value.preset === p.key ? 'primary' : 'default'}
          variant={value.preset === p.key ? 'solid' : 'flat'}
          onPress={() => onChange({ preset: p.key })}
          className="min-w-12"
        >
          {p.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}
