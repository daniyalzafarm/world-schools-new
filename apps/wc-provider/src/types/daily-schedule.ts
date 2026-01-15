export interface TimeSlot {
  id: string
  time: string
  activity: string
  description?: string
}

export interface Schedule {
  id: string
  type: 'daily' | 'weekly'
  ageGroup?: string
  day?: string
  timeSlots: TimeSlot[]
}

export interface DailyScheduleData {
  schedules: Schedule[]
}
