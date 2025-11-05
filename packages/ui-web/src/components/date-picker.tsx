import React from 'react';
import {
  type DatePickerProps,
  DatePicker as HeroDatePicker,
} from '@heroui/react';
import { cn } from '../utils/cn';

export interface CustomDatePickerProps
  extends Omit<DatePickerProps, 'classNames'> {
  classNames?: DatePickerProps['classNames'];
}

export const DatePicker: React.FC<CustomDatePickerProps> = ({
  classNames: customClassNames,
  ...props
}) => {
  const mergedClassNames = {
    ...customClassNames,
    ...{
      base: cn('w-full', customClassNames?.base),
      inputWrapper: cn(
        'rounded-md border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white hover:bg-gray-50 dark:hover:bg-gray-900 p-4 py-5.5',
        'focus-within:border-gray-400 dark:focus-within:border-gray-500',
        'focus-within:bg-gray-50 dark:focus-within:bg-gray-900',
        customClassNames?.inputWrapper,
        props.isInvalid && 'border-red-500',
      ),
      input: cn('text-md', customClassNames?.input),
    },
  };

  return <HeroDatePicker {...props} classNames={mergedClassNames} />;
};
