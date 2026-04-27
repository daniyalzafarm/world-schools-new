import { cn } from '@world-schools/ui-web'

interface SafetyRatio {
  label: string
  ratio: string
}

interface SafetyCardProps {
  ratios?: SafetyRatio[]
  items?: string[]
  description?: string
  className?: string
}

function CheckIcon() {
  return (
    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="#0ea572"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3 h-3"
      >
        <polyline points="2 6 5 9 10 3" />
      </svg>
    </div>
  )
}

export function SafetyCard({ ratios, items, description, className }: SafetyCardProps) {
  const hasRatios = ratios && ratios.length > 0
  const hasItems = items && items.length > 0
  const hasDescription = !!description

  if (!hasRatios && !hasItems && !hasDescription) return null

  return (
    <div className={cn('border border-gray-200 rounded-2xl overflow-hidden', className)}>
      {/* Staff ratios grid — grouped into rows of up to 3 */}
      {hasRatios && (
        <div className="border-b border-gray-200">
          {Array.from({ length: Math.ceil(ratios.length / 3) }, (_, rowIdx) => {
            const row = ratios.slice(rowIdx * 3, rowIdx * 3 + 3)
            const cols = row.length // 1, 2, or 3
            return (
              <div
                key={rowIdx}
                className={cn(
                  'grid',
                  cols === 1 && 'grid-cols-1',
                  cols === 2 && 'grid-cols-2',
                  cols === 3 && 'grid-cols-2 sm:grid-cols-3',
                  rowIdx > 0 && 'border-t border-gray-200'
                )}
              >
                {row.map((ratio, colIdx) => {
                  const isThirdOfThree = cols === 3 && colIdx === 2
                  return (
                    <div
                      key={colIdx}
                      className={cn(
                        'bg-gray-50 p-4 text-center',
                        colIdx === 1 && 'border-l border-gray-200',
                        isThirdOfThree &&
                          'col-span-2 sm:col-span-1 border-t border-gray-200 sm:border-t-0 sm:border-l',
                        colIdx > 2 && 'border-l border-gray-200'
                      )}
                    >
                      <span className="block text-2xl font-extrabold text-gray-900 leading-tight mb-1">
                        {ratio.ratio}
                      </span>
                      <span className="text-sm text-gray-500 leading-snug">{ratio.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Safety items list */}
      {hasItems && (
        <div className={cn('px-6 py-5', hasDescription && 'border-b border-gray-200')}>
          {items.map((item, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2.5 py-1.5',
                i > 0 && 'border-t border-gray-100'
              )}
            >
              <CheckIcon />
              <span className="text-sm text-gray-700 font-medium">{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {hasDescription && (
        <div className="p-5 sm:p-6">
          <p className="text-gray-900 leading-relaxed">{description}</p>
        </div>
      )}
    </div>
  )
}
