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
          <div key={index} className="flex items-center gap-2 text-sm text-gray-900">
            <span
              className={`text-base font-bold shrink-0 ${included ? 'text-primary' : 'text-gray-400'}`}
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
