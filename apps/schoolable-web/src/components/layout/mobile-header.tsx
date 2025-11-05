'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { ChevronLeft, Menu, X } from 'lucide-react'
import { cn } from "@world-schools/ui-web"

interface MobileHeaderProps {
  title?: string
  showMenuButton?: boolean
  showBackButton?: boolean
  menuOpen?: boolean
  onMenuToggle?: () => void
  onBackPress?: () => void
  rightContent?: React.ReactNode
  className?: string
}

export function MobileHeader({
  title,
  showMenuButton = true,
  showBackButton = false,
  menuOpen = false,
  onMenuToggle,
  onBackPress,
  rightContent,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'relative flex items-center justify-between px-4 py-1 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 lg:hidden z-50',
        className
      )}
    >
      {/* Left side - Menu or Back button */}
      <div className="flex items-center">
        {showBackButton && onBackPress ? (
          <Button
            isIconOnly
            variant="light"
            onPress={onBackPress}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          >
            <ChevronLeft size={24} />
          </Button>
        ) : showMenuButton && onMenuToggle ? (
          <Button
            isIconOnly
            variant="light"
            onPress={onMenuToggle}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
          >
            <div className="relative w-6 h-6">
              <Menu
                size={24}
                className={cn(
                  'absolute inset-0 transition-all duration-200',
                  menuOpen ? 'opacity-0 rotate-90 scale-75' : 'opacity-100 rotate-0 scale-100'
                )}
              />
              <X
                size={24}
                className={cn(
                  'absolute inset-0 transition-all duration-200',
                  menuOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
                )}
              />
            </div>
          </Button>
        ) : null}
      </div>

      {/* Center - Title */}
      {title && (
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
      )}

      {/* Right side - Custom content */}
      <div className="flex items-center">{rightContent}</div>
    </header>
  )
}
