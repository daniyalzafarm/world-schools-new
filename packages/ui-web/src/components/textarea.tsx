'use client'

import React from 'react'
import { Textarea as HeroTextarea, type TextAreaProps } from '@heroui/react'
import { cn } from '../utils/cn'

export interface CustomTextareaProps extends Omit<TextAreaProps, 'classNames'> {
  classNames?: TextAreaProps['classNames']
}

export const Textarea: React.FC<CustomTextareaProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      inputWrapper: cn(
        'rounded-lg bg-white',
        'border border-gray-200',
        'hover:border-gray-300',
        'focus-within:border-primary!',
        'focus-within:!bg-white',
        'focus-within:outline-none',
        'dark:border-gray-600',
        customClassNames?.inputWrapper
      ),
      input: cn(customClassNames?.input),
    },
  }

  return <HeroTextarea {...props} classNames={mergedClassNames} />
}
