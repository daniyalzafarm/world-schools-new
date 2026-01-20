interface SafetyRatio {
  label: string
  ratio: string
  icon: string
}

interface SafetyCardProps {
  ratios?: SafetyRatio[]
  items?: string[]
  className?: string
}

export function SafetyCard({ ratios, items, className = '' }: SafetyCardProps) {
  return (
    <div className={className}>
      {ratios && ratios.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {ratios.map((ratio, index) => (
            <div key={index} className="bg-[#F7F7F7] rounded-xl p-4 text-center">
              <div className="text-[32px] mb-2">{ratio.icon}</div>
              <div className="text-[20px] font-bold text-[#222222] mb-1">{ratio.ratio}</div>
              <div className="text-[13px] text-[#717171]">{ratio.label}</div>
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <span className="text-[#45F0B5] text-[18px] font-bold flex-shrink-0 mt-0.5">✓</span>
              <span className="text-[15px] text-[#222222]">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
