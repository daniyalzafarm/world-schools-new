interface IncludedItem {
  text: string
  included?: boolean
}

interface IncludedGridProps {
  items: IncludedItem[] | string[]
  className?: string
}

export function IncludedGrid({ items, className = '' }: IncludedGridProps) {
  if (!items || items.length === 0) return null

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {items.map((item, index) => {
        const text = typeof item === 'string' ? item : item.text
        const included = typeof item === 'string' ? true : item.included !== false

        return (
          <div key={index} className="flex items-center gap-2 text-[14px] text-[#222222]">
            <span
              className={`text-[16px] font-bold flex-shrink-0 ${included ? 'text-[#45F0B5]' : 'text-[#B0B0B0]'}`}
            >
              {included ? '✓' : '✗'}
            </span>
            <span className="flex-1">{text}</span>
          </div>
        )
      })}
    </div>
  )
}
