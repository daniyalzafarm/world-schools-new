'use client'

import { Button } from '@heroui/react'
import { X } from 'lucide-react'
import { cn } from '../utils/cn'

interface ChipButtonProps {
  label: string
  selected?: boolean
  onPress?: () => void
  canClose?: boolean
  className?: string
}

export function ChipButton({
  label,
  selected = false,
  onPress,
  canClose = false,
  className,
}: ChipButtonProps) {
  return (
    <Button
      variant={selected ? 'solid' : 'bordered'}
      color={selected ? 'primary' : 'default'}
      size="sm"
      onPress={onPress}
      className={cn(
        'rounded-full text-primary-dark border h-8 px-3 mr-2 mb-2 min-w-12 text-sm font-medium transition-all duration-200',
        selected
          ? 'bg-primary-100 border-primary-100 hover:bg-primary-100'
          : 'bg-transparent border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700',
        className
      )}
      startContent={
        canClose ? (
          <div className="w-4 h-4 flex items-center justify-center">
            <X size={12} />
          </div>
        ) : undefined
      }
    >
      {label}
    </Button>
  )
}
