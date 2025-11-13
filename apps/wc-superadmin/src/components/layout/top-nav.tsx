'use client'

import React from 'react'
import { Button, Input, Tooltip } from '@heroui/react'
import { useTheme } from 'next-themes'
import {
  Bell,
  Menu,
  MoonStar,
  Search,
  Sun,
} from 'lucide-react'

interface TopNavProps {
  onToggleSidebar: () => void
}

export function TopNav({ onToggleSidebar }: TopNavProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            radius="full"
            className="lg:hidden"
            onPress={onToggleSidebar}
          >
            <Menu size={20} />
          </Button>

          <div className="hidden lg:flex items-center gap-3 flex-1">
            <Input
              startContent={<Search size={16} className="text-slate-400" />}
              placeholder="Search providers, users, tasks..."
              radius="full"
              variant="flat"
              className="max-w-xl"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Tooltip content="Toggle theme" placement="bottom">
              <Button
                isIconOnly
                variant="light"
                radius="full"
                onPress={handleToggleTheme}
              >
                {resolvedTheme === 'dark' ? <Sun size={18} /> : <MoonStar size={18} />}
              </Button>
            </Tooltip>
            <Tooltip content="Notifications" placement="bottom">
              <Button isIconOnly variant="light" radius="full">
                <Bell size={18} />
              </Button>
            </Tooltip>
            <Button color="primary" radius="full" className="hidden md:flex">
              New Provider
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
