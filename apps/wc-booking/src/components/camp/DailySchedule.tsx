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
            <div className="w-3 h-3 rounded-full bg-[#45F0B5] flex-shrink-0 mt-1.5"></div>
            {index < schedule.length - 1 && (
              <div className="w-0.5 h-full bg-[#DDDDDD] flex-1 mt-1"></div>
            )}
          </div>
          <div className="flex-1 pb-6">
            <div className="text-[14px] font-semibold text-[#717171] mb-1">{item.time}</div>
            <div className="text-[16px] font-semibold text-[#222222] mb-1">{item.activity}</div>
            {item.description && (
              <div className="text-[15px] text-[#717171]">{item.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
