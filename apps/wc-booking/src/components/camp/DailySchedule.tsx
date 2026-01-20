interface ScheduleItem {
  time: string
  activity: string
  description?: string
}

interface DailyScheduleProps {
  schedule: ScheduleItem[]
  className?: string
}

export function DailySchedule({ schedule, className = '' }: DailyScheduleProps) {
  if (!schedule || schedule.length === 0) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {schedule.map((item, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-1.5"></div>
            {index < schedule.length - 1 && (
              <div className="w-0.5 h-full bg-gray-300 flex-1 mt-1"></div>
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="text-sm font-semibold text-gray-500 mb-1">{item.time}</div>
            <div className="text-base font-semibold text-gray-900 mb-1">{item.activity}</div>
            {item.description && <div className="text-base text-gray-500">{item.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
