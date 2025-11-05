import React from 'react';
import { Input as HeroInput, type InputProps } from '@heroui/react';
import { cn } from '../utils/cn';

export interface CustomInputProps extends Omit<InputProps, 'classNames'> {
  classNames?: InputProps['classNames'];
}

export const Input: React.FC<CustomInputProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      inputWrapper: cn(
        'rounded-md bg-white p-4 py-5.5',
        'border border-gray-300 dark:border-gray-600',
        'focus-within:border-gray-400',
        'focus-within:bg-gray-50',
        'data-[hover=true]:bg-gray-100',
        customClassNames?.inputWrapper,
      ),
      input: cn('text-md', customClassNames?.input),
    },
  };

  return <HeroInput {...props} classNames={mergedClassNames} />;
};
