'use client'

import { Slider } from '@heroui/react'
import { cn } from '../utils/cn'

interface RangeSliderProps {
  min: number
  max: number
  step?: number
  values: [number, number]
  onChange?: (values: [number, number]) => void
  className?: string
  formatLabel?: (value: number) => string
  color?: 'primary' | 'secondary'
}

export function RangeSlider({
  min,
  max,
  step = 1,
  values,
  onChange,
  className,
  formatLabel,
  color = 'primary',
}: RangeSliderProps) {
  const handleChange = (value: number | number[]) => {
    if (Array.isArray(value) && value.length === 2) {
      onChange?.([value[0], value[1]])
    }
  }

  // Dynamic color classes based on color prop
  const fillerClass = color === 'primary' ? 'bg-primary' : 'bg-secondary'
  const borderClass = color === 'primary' ? 'border-primary' : 'border-secondary'
  const bgClass = color === 'primary' ? 'bg-primary' : 'bg-secondary'

  return (
    <div className={cn('w-full', className)}>
      <Slider
        aria-label="Range slider"
        size="md"
        step={step}
        minValue={min}
        maxValue={max}
        value={values}
        onChange={handleChange}
        formatOptions={formatLabel ? { style: 'currency', currency: 'USD' } : undefined}
        className="w-full"
        classNames={{
          base: 'w-full',
          track: 'h-3 bg-gray-200 dark:bg-gray-700',
          filler: fillerClass,
          thumb: [
            cn('w-6 h-6 bg-white border-2 shadow-md', borderClass),
            cn('after:w-4 after:h-4 after:rounded-full', `after:${bgClass}`),
            'data-[dragging=true]:shadow-lg',
          ],
        }}
        renderThumb={props => (
          <div
            {...props}
            className={cn(
              'group p-1 top-1/2 bg-white border-2 rounded-full cursor-grab data-[dragging=true]:cursor-grabbing shadow-md transition-shadow',
              borderClass
            )}
          >
            <span
              className={cn(
                'transition-transform rounded-full w-4 h-4 block group-data-[dragging=true]:scale-80',
                bgClass
              )}
            />
          </div>
        )}
      />
    </div>
  )
}
