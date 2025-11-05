'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalHeader, ScrollShadow } from '@heroui/react'
import { cn, Input } from '@world-schools/ui-web'
import { Clock, Edit, MessageCircle, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ChatHistoryItem } from '@/types/chat'
import { searchChatHistory } from '@/data/chat-history'
import { useChatHistoryStore } from '@/stores/chat-history-store'
import { getGroupedHistory, getPinnedHistory } from '@/utils/chat-history-helpers'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

type FocusableItem =
  | { type: 'new-chat'; id: string }
  | { type: 'history'; id: string; data: ChatHistoryItem }

// Reusable component for rendering history items
const HistoryItem = ({
  item,
  isFocused,
  onClick,
}: {
  item: ChatHistoryItem
  isFocused: boolean
  onClick: () => void
}) => (
  <div
    onClick={onClick}
    className={cn(
      'group p-2 rounded-lg cursor-pointer',
      'hover:bg-gray-200 dark:hover:bg-gray-800/50',
      'transition-all duration-200',
      isFocused && 'bg-gray-200 dark:bg-gray-800/50'
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="flex-shrink-0" />
          <h4 className="font-medium truncate flex-1 min-w-0">{item.title}</h4>
          <span className="text-sm transition-opacity duration-200 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100">
            {item.timestamp}
          </span>
        </div>
      </div>
    </div>
  </div>
)

export function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { chatHistory } = useChatHistoryStore()

  // Get grouped history using helper function with store data
  const groupedHistory = useMemo(() => {
    return getGroupedHistory(chatHistory)
  }, [chatHistory])

  // Get pinned history using helper function with store data
  const pinnedHistory = useMemo(() => {
    return getPinnedHistory(chatHistory)
  }, [chatHistory])

  // Filter history items based on search query
  const filteredHistory = useMemo(() => {
    return searchChatHistory(searchQuery)
  }, [searchQuery])

  // Get all focusable items (New Chat + search results or grouped history)
  const focusableItems = useMemo((): FocusableItem[] => {
    if (searchQuery) {
      // When searching, only return search results (no "New Chat" option)
      return filteredHistory.map(item => ({ type: 'history' as const, id: item.id, data: item }))
    }

    // When not searching, include "New Chat" + all history items
    const allHistoryItems = [...pinnedHistory, ...Object.values(groupedHistory).flat()]

    return [
      { type: 'new-chat' as const, id: 'new-chat' },
      ...allHistoryItems.map(item => ({ type: 'history' as const, id: item.id, data: item })),
    ]
  }, [searchQuery, filteredHistory, pinnedHistory, groupedHistory])

  // Reset focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0) // Always focus on "New Chat" when modal opens
      // Focus the search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Update focus when search results change
  useEffect(() => {
    setFocusedIndex(0) // Always focus on first available item
  }, [searchQuery, filteredHistory.length])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => Math.min(prev + 1, focusableItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const focusedItem = focusableItems[focusedIndex]
      if (focusedItem) {
        if (focusedItem.type === 'new-chat') {
          router.push('/chat/new')
          onClose()
        } else if (focusedItem.type === 'history' && focusedItem.data) {
          handleHistoryItemClick(focusedItem.data)
        }
      }
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault()
      // Let the modal handle these keys
      handleKeyDown(e)
    }
  }

  const handleHistoryItemClick = (item: ChatHistoryItem) => {
    // Navigate to the specific chat
    router.push(`/chat/${item.id}`)
    onClose()
  }

  const _handleClose = () => {
    setSearchQuery('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      size="2xl"
      scrollBehavior="inside"
      onKeyDown={handleKeyDown}
      onClose={_handleClose}
      classNames={{
        base: 'h-[440px] z-50',
        body: 'p-0',
        header: 'pb-4',
      }}
    >
      <ModalContent>
        <ModalHeader className="mt-3 pt-0 px-0">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onValueChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search chats..."
            endContent={
              <Button isIconOnly variant="light" radius="full" size="sm" onPress={onClose}>
                <X size={20} />
              </Button>
            }
            classNames={{
              base: 'w-full',
              input: 'text-[16px]',
              inputWrapper: cn(
                'px-6 pb-7 focus-within:bg-transparent focus-within:border-gray-200 border-0 border-b shadow-none border-gray-200 dark:border-gray-700 rounded-none',
                'data-[hover=true]:bg-transparent'
              ),
            }}
          />
        </ModalHeader>

        <ModalBody className="gap-1">
          {!searchQuery && (
            <div className="px-4">
              <div
                onClick={() => {
                  router.push('/chat/new')
                  onClose()
                }}
                className={cn(
                  'p-2 px-4 rounded-lg cursor-pointer',
                  'hover:bg-gray-200 dark:hover:bg-gray-800/50',
                  'transition-all duration-200',
                  focusedIndex === 0 && 'bg-gray-200 dark:bg-gray-800/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Edit size={20} />
                  <h4 className="font-medium truncate">New Chat</h4>
                </div>
              </div>
            </div>
          )}

          {/* History List */}
          <ScrollShadow className="max-h-[50vh]">
            <div className="px-6 pb-6">
              {searchQuery ? (
                // Show search results
                filteredHistory.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <Search size={18} className="text-gray-500 dark:text-gray-400" />
                    <p className="font-medium text-gray-500 dark:text-gray-400">No results</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredHistory.map((item, index) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        isFocused={focusedIndex === index}
                        onClick={() => handleHistoryItemClick(item)}
                      />
                    ))}
                  </div>
                )
              ) : (
                // Show grouped history
                (() => {
                  const hasPinnedHistory = pinnedHistory.length > 0
                  const hasGroupedHistory = Object.keys(groupedHistory).length > 0

                  if (!hasPinnedHistory && !hasGroupedHistory) {
                    return (
                      <div className="text-center py-12">
                        <Clock size={48} className="text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          No chat history yet
                        </h3>
                        <p className=" mb-4">
                          Start a new conversation to see your chat history here.
                        </p>
                        <Button
                          color="primary"
                          onPress={() => {
                            router.push('/chat/new')
                            onClose()
                          }}
                        >
                          Start New Chat
                        </Button>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {/* Pinned Section */}
                      {hasPinnedHistory && (
                        <div className="space-y-2">
                          <div className="px-2 py-1">
                            <span className="text-sm font-bold text-secondary tracking-wide">
                              Pinned
                            </span>
                          </div>
                          {pinnedHistory.map((item, index) => {
                            const itemIndex = index + 1 // +1 because "New Chat" is at index 0
                            return (
                              <HistoryItem
                                key={item.id}
                                item={item}
                                isFocused={focusedIndex === itemIndex}
                                onClick={() => handleHistoryItemClick(item)}
                              />
                            )
                          })}
                        </div>
                      )}

                      {/* Grouped History Sections */}
                      {Object.entries(groupedHistory).map(([timeGroup, items]) => {
                        let currentIndex = pinnedHistory.length + 1 // Start after "New Chat" and pinned items

                        return (
                          <div key={timeGroup} className="space-y-2">
                            <div className="px-2 py-1">
                              <span className="text-sm font-bold text-secondary tracking-wide">
                                {timeGroup}
                              </span>
                            </div>
                            {items.map(item => {
                              const itemIndex = currentIndex++
                              return (
                                <HistoryItem
                                  key={item.id}
                                  item={item}
                                  isFocused={focusedIndex === itemIndex}
                                  onClick={() => handleHistoryItemClick(item)}
                                />
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              )}
            </div>
          </ScrollShadow>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
