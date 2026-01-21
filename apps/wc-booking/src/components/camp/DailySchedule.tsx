interface ScheduleItem {
  id?: string
  time: string
  activity: string
  description?: string
}

interface DailyScheduleProps {
  schedule: ScheduleItem[]
  className?: string
}

/**
 * Format time from 24-hour format (e.g., "08:00") to 12-hour format (e.g., "8:00 AM")
 */
function formatTime(time: string): string {
  // If already formatted, return as is
  if (time.includes('AM') || time.includes('PM')) {
    return time
  }

  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function DailySchedule({ schedule, className = '' }: DailyScheduleProps) {
  if (!schedule || schedule.length === 0) return null

  return (
    <div className={`${className}`}>
      {schedule.map((item, index) => (
        <div key={item.id || index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="rounded-full p-1 border border-primary flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
            </div>
            {index < schedule.length - 1 && <div className="w-0.5 h-full bg-gray-300 flex-1"></div>}
          </div>
          <div className="flex-1 pb-6 -mt-0.5">
            <div className="font-semibold text-gray-900">{formatTime(item.time)}</div>
            <div className="font-medium text-gray-500">{item.activity}</div>
            {item.description && <div className="text-base text-gray-500">{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
