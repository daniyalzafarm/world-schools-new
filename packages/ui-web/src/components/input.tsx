'use client'

import React from 'react'
import { Input as HeroInput, type InputProps } from '@heroui/react'
import { cn } from '../utils/cn'

export interface CustomInputProps extends Omit<InputProps, 'classNames'> {
  classNames?: InputProps['classNames']
}

export const Input: React.FC<CustomInputProps> = ({ classNames: customClassNames, ...props }) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      inputWrapper: cn(
        'rounded-lg bg-white',
        'border border-gray-200',
        'hover:border-gray-300',
        'focus-within:border-primary!',
        'focus-within:bg-white!',
        'dark:border-gray-600',
        customClassNames?.inputWrapper
      ),
      input: cn(customClassNames?.input),
    },
  }

  return <HeroInput {...props} classNames={mergedClassNames} />
}
