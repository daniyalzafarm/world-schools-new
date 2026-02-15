'use client'

import React from 'react'
import { type TimeInputProps, TimeInput as HeroTimeInput } from '@heroui/react'
import { Clock } from 'lucide-react'
import { cn } from '../utils/cn'

export interface CustomTimeInputProps extends Omit<TimeInputProps, 'classNames'> {
  classNames?: TimeInputProps['classNames']
}

export const TimeInput: React.FC<CustomTimeInputProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      base: cn('w-full', customClassNames?.base),
      inputWrapper: cn(
        'rounded-lg bg-white',
        'border border-gray-200',
        'hover:border-gray-300',
        'focus-within:border-primary!',
        'focus-within:bg-white!',
        'dark:border-gray-600',
        customClassNames?.inputWrapper,
        props.isInvalid && 'border-red-500'
      ),
      input: cn(customClassNames?.input),
    },
  }

  return (
    <HeroTimeInput
      {...{ endContent: <Clock size={20} className="text-gray-500" />, ...props }}
      classNames={mergedClassNames}
    />
  )
}
