'use client'

import React from 'react';
import { Textarea as HeroTextarea, type TextAreaProps } from '@heroui/react';
import { cn } from '../utils/cn';

export interface CustomTextareaProps extends Omit<TextAreaProps, 'classNames'> {
  classNames?: TextAreaProps['classNames'];
}

export const Textarea: React.FC<CustomTextareaProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      inputWrapper: cn(
        'rounded-md bg-white p-4',
        'border border-gray-300 dark:border-gray-600',
        'focus-within:border-gray-400',
        'focus-within:bg-gray-50',
        'data-[hover=true]:bg-gray-100',
        customClassNames?.inputWrapper,
      ),
      input: cn('text-md', customClassNames?.input),
    },
  };

  return <HeroTextarea {...props} classNames={mergedClassNames} />;
};
