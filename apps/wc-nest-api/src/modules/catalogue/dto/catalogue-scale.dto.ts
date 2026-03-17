export class ActivityScaleLevelDto {
  id!: string
  value!: string
  label!: string
  order!: number
}

export class ActivityScaleWithUsageDto {
  id!: string
  name!: string
  description?: string | null
  visualType!: string
  colorKey!: string
  levels!: ActivityScaleLevelDto[]
  usedByCount!: number
}
