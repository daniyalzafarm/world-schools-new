'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { Archive } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ArchivedChatsButtonProps {
  archivedCount: number
  isAdmin?: boolean
}

export function ArchivedChatsButton({ archivedCount, isAdmin }: ArchivedChatsButtonProps) {
  const router = useRouter()

  const handlePress = () => {
    if (isAdmin) {
      router.push('/admin/messages/archived')
    } else {
      router.push('/messages/archived')
    }
  }

  return (
    <Button
      variant="light"
      onPress={handlePress}
      className="w-full justify-start pl-5 py-2 rounded-none h-auto bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50"
    >
      <div className="flex items-center w-full">
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3">
          <Archive size={20} className="text-gray-600 dark:text-gray-400" />
        </div>
        <span className="text-gray-500 dark:text-gray-100">Archived Chats</span>
        <span className="text-gray-500 dark:text-gray-100 ml-auto mr-2">{archivedCount}</span>
      </div>
    </Button>
  )
}
