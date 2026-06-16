'use client'

import React, { useState } from 'react'
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react'
import {
  Archive,
  BadgeCheck,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  MoreVertical,
  Pin,
  PinOff,
  Star,
} from 'lucide-react'

import { cn } from '../../utils/cn'
import { formatShortRelativeTime, isUserOnline } from '../../utils/time-format'
import type { Conversation } from '../../types/messages'
import { UserAvatar } from '../user-avatar'

// Avatar mapping - matching the mobile and Messages page implementation
const avatarMap: Record<string, string> = {
  'child-1': '/assets/child-1.jpg',
  'child-2': '/assets/child-2.jpg',
  'school-1': '/assets/school-1.jpg',
  'school-2': '/assets/school-2.jpg',
  'school-3': '/assets/school-3.jpg',
}

interface ConversationItemProps {
  conversation: Conversation
  isActive?: boolean
  onPress?: (conversation: Conversation) => void
  onPin?: (conversationId: string) => void
  onArchive?: (conversationId: string) => void
  onMute?: (conversationId: string) => void
  onMarkAsUnread?: (conversationId: string) => void
  onMarkAsRead?: (conversationId: string) => void
  onToggleFavorite?: (conversationId: string) => void
  showActions?: boolean
}

export function ConversationItem({
  conversation,
  isActive = false,
  onPress,
  onPin,
  onArchive,
  onMute,
  onMarkAsUnread,
  onMarkAsRead,
  onToggleFavorite,
  showActions = true,
}: ConversationItemProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Use avatar URL/path if provided; otherwise allow Avatar to fall back to initials.
  const avatarSrc =
    conversation.avatar && avatarMap[String(conversation.avatar)]
      ? avatarMap[String(conversation.avatar)]
      : conversation.avatar || undefined

  // Handle click
  const handleClick = () => {
    if (onPress) {
      onPress(conversation)
    }
  }

  return (
    <div
      className={cn(
        'p-4 cursor-pointer relative group',
        !isActive && 'hover:bg-gray-200 dark:hover:bg-gray-800/50',
        isPressed && 'bg-gray-100 dark:bg-gray-700',
        isActive && 'bg-primary-100 dark:bg-gray-700'
      )}
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsPressed(false)
        setIsHovered(false)
      }}
    >
      <div className="flex items-center">
        {/* Avatar */}
        <UserAvatar
          photoUrl={avatarSrc}
          fullName={conversation.name}
          className="w-10 h-10 mr-3 text-base"
          variant="flat"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              <h6 className={cn('truncate', conversation.unread && 'font-bold')}>
                {conversation.name}
              </h6>
              {conversation.verified && (
                <BadgeCheck
                  size={20}
                  fill="current"
                  className="ml-1 stroke-white fill-blue-600 dark:fill-blue-400"
                />
              )}
            </div>
          </div>
          {conversation.contextLabel ? (
            <p className="text-sm text-secondary truncate">
              Asks about:{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {conversation.contextLabel}
              </span>
            </p>
          ) : conversation.unread ? (
            <div className="flex items-center gap-2 text-sm">
              <p className="truncate font-bold">{conversation.lastMessage}</p>
              <span className="text-xs text-gray-400">•</span>
              <p className="text-secondary">{formatShortRelativeTime(conversation.time)}</p>
            </div>
          ) : (
            <p
              className={cn(
                'text-sm text-secondary',
                isUserOnline(conversation.lastSeen) && 'text-green-600 dark:text-green-400'
              )}
            >
              Active {formatShortRelativeTime(conversation.lastSeen, 'ago')}
            </p>
          )}
        </div>

        {/* Right side info */}
        <div className="flex items-center gap-1.5 h-6">
          {conversation.muted && (
            <BellOff size={16} className="text-secondary dark:text-gray-400" />
          )}
          {conversation.pinned && <Pin size={16} className="text-secondary dark:text-gray-400" />}
          {(conversation.unreadCount ?? 0) > 0 ? (
            <span className="ml-auto bg-primary-500 text-white text-xs font-medium rounded-full px-1.5 py-0.5 min-w-5 text-center leading-none">
              {(conversation.unreadCount ?? 0) > 99 ? '99+' : conversation.unreadCount}
            </span>
          ) : (
            // Manually-marked-unread conversations have no count — show a dot.
            conversation.unread && (
              <span className="ml-auto w-2.5 h-2.5 rounded-full bg-primary-500" />
            )
          )}
          {showActions && isHovered && (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <button className="cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-800/70 rounded-lg p-1">
                  <MoreVertical size={16} />
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Conversation actions"
                disabledKeys={
                  conversation.canManageSettings === false
                    ? ['favorite', 'pin', 'mute', 'archive', 'unread']
                    : []
                }
              >
                <DropdownItem
                  key="favorite"
                  startContent={
                    conversation.starred ? <Star size={16} fill="current" /> : <Star size={16} />
                  }
                  onPress={() => onToggleFavorite?.(conversation.id)}
                >
                  {conversation.starred ? 'Remove from Favorites' : 'Add to Favorites'}
                </DropdownItem>

                <DropdownItem
                  key="pin"
                  startContent={conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  onPress={() => onPin?.(conversation.id)}
                >
                  {conversation.pinned ? 'Unpin' : 'Pin'}
                </DropdownItem>

                <DropdownItem
                  key="mute"
                  startContent={conversation.muted ? <Bell size={16} /> : <BellOff size={16} />}
                  onPress={() => onMute?.(conversation.id)}
                >
                  {conversation.muted ? 'Unmute' : 'Mute'}
                </DropdownItem>

                <DropdownItem
                  key="unread"
                  startContent={conversation.unread ? <Eye size={16} /> : <EyeOff size={16} />}
                  onPress={() =>
                    conversation.unread
                      ? onMarkAsRead?.(conversation.id)
                      : onMarkAsUnread?.(conversation.id)
                  }
                >
                  {conversation.unread ? 'Mark as Read' : 'Mark as Unread'}
                </DropdownItem>

                <DropdownItem
                  key="archive"
                  startContent={<Archive size={16} />}
                  onPress={() => onArchive?.(conversation.id)}
                >
                  {conversation.archived ? 'Unarchive' : 'Archive'}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </div>
    </div>
  )
}
