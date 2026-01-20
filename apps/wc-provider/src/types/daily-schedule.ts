export interface TimeSlot {
  id: string
  time: string
  activity: string
  description?: string
}

export interface DailyScheduleData {
  scheduleType?: 'daily' | 'weekly'
  dailySchedule?: {
    timeSlots: TimeSlot[]
  }
  weeklySchedule?: {
    [key: string]: {
      // monday, tuesday, etc.
      timeSlots: TimeSlot[]
    }
  }
}

// Legacy type for backward compatibility
export interface Schedule {
  id: string
  type: 'daily' | 'weekly'
  ageGroup?: string
  day?: string
  timeSlots: TimeSlot[]
}
