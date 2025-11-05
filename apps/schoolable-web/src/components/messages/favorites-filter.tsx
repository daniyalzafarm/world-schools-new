'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { Star } from 'lucide-react'
import { cn } from "@world-schools/ui-web"

interface FavoritesFilterProps {
  isActive: boolean
  onToggle: () => void
  favoritesCount: number
}

export function FavoritesFilter({ isActive, onToggle, favoritesCount }: FavoritesFilterProps) {
  return (
    <div className="px-6 pb-2">
      <Button
        variant={isActive ? 'solid' : 'bordered'}
        color={isActive ? 'primary' : 'default'}
        size="sm"
        onPress={onToggle}
        startContent={
          <Star size={16} className={cn(isActive ? 'text-white fill-current' : 'text-primary')} />
        }
        className={cn(
          'rounded-full transition-all duration-200',
          isActive
            ? 'bg-primary text-white'
            : 'bg-transparent border-primary text-primary hover:bg-primary/10'
        )}
      >
        Favorites {favoritesCount > 0 && `(${favoritesCount})`}
      </Button>
    </div>
  )
}
