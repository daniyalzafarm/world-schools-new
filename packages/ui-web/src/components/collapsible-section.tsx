'use client';

import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils/cn';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className,
  isExpanded,
  onToggle,
}: CollapsibleSectionProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

  // Use external control if provided, otherwise use internal state
  const isOpen = isExpanded ?? internalIsOpen;
  const setIsOpen = onToggle ?? (() => setInternalIsOpen(!internalIsOpen));

  return (
    <div
      className={cn(
        'border border-gray-200 dark:border-gray-700 rounded-lg',
        className,
      )}
    >
      <Button
        variant="light"
        onPress={() => setIsOpen()}
        className="w-full justify-between p-4 h-auto rounded-none rounded-t-lg hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </span>
        {isOpen ? (
          <ChevronUp size={20} className="text-gray-500" />
        ) : (
          <ChevronDown size={20} className="text-gray-500" />
        )}
      </Button>

      {isOpen && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
}
