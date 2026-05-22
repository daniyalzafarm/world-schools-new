import { BadRequestException } from '@nestjs/common'
import type { DashboardRangePreset } from './dto/analytics-range.dto'

export interface ResolvedRange {
  from: Date
  to: Date
  /// Previous-period window of identical length, anchored immediately before `from`.
  previousFrom: Date
  previousTo: Date
  /// `day` for ≤30 days, `week` for ≤90 days, `month` otherwise.
  bucket: 'day' | 'week' | 'month'
  preset: DashboardRangePreset
}

const PRESET_DAYS: Record<Exclude<DashboardRangePreset, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export function resolveRange(input: {
  range?: DashboardRangePreset
  from?: string
  to?: string
}): ResolvedRange {
  const preset = input.range ?? '30d'
  const now = new Date()

  let from: Date
  let to: Date

  if (preset === 'custom') {
    if (!input.from || !input.to) {
      throw new BadRequestException('from and to are required when range=custom')
    }
    from = new Date(input.from)
    to = new Date(input.to)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new BadRequestException('Invalid custom range — from must be before to')
    }
  } else {
    to = now
    from = new Date(now.getTime() - PRESET_DAYS[preset] * 24 * 60 * 60 * 1000)
  }

  const windowMs = to.getTime() - from.getTime()
  const previousTo = new Date(from.getTime())
  const previousFrom = new Date(from.getTime() - windowMs)

  const days = Math.ceil(windowMs / (24 * 60 * 60 * 1000))
  const bucket: ResolvedRange['bucket'] = days <= 30 ? 'day' : days <= 90 ? 'week' : 'month'

  return { from, to, previousFrom, previousTo, bucket, preset }
}
