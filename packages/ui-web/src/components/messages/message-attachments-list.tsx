'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { FileText, Image as ImageIcon, Music, Video, Download, File } from 'lucide-react'
import type { MessageAttachment } from '../../types/messages'

export interface MessageAttachmentsListProps {
  attachments: MessageAttachment[]
}

export function MessageAttachmentsList({ attachments }: MessageAttachmentsListProps) {
  if (!attachments || attachments.length === 0) return null

  const openInNewTab = (url: string) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const renderIcon = (fileType: MessageAttachment['fileType']) => {
    switch (fileType) {
      case 'IMAGE':
        return <ImageIcon className="w-4 h-4" />
      case 'AUDIO':
        return <Music className="w-4 h-4" />
      case 'VIDEO':
        return <Video className="w-4 h-4" />
      case 'DOCUMENT':
        return <FileText className="w-4 h-4" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return ''
    if (bytes < 1024) return `${bytes} B`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map(att => {
        const key = att.id || `${att.fileName}-${att.url}`
        const isImage = att.fileType === 'IMAGE'
        const isAudio = att.fileType === 'AUDIO'
        const isVideo = att.fileType === 'VIDEO'

        if (isImage) {
          return (
            <div key={key} className="relative inline-block max-w-xs overflow-hidden rounded-lg">
              <img
                src={att.thumbnailUrl || att.url}
                alt={att.fileName}
                className="max-h-64 w-auto cursor-pointer object-cover transition-transform hover:scale-[1.02]"
                onClick={() => openInNewTab(att.url)}
              />
            </div>
          )
        }

        if (isAudio) {
          return (
            <div key={key} className="rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-800">
              <div className="flex items-center gap-2 mb-1 text-xs text-gray-700 dark:text-gray-200">
                <Music className="w-4 h-4" />
                <span className="truncate max-w-[180px]">{att.fileName}</span>
                <span className="text-gray-400 dark:text-gray-500">{formatSize(att.fileSize)}</span>
              </div>
              <audio controls className="w-full">
                <source src={att.url} />
              </audio>
            </div>
          )
        }

        if (isVideo) {
          return (
            <div key={key} className="rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
              <video
                controls
                className="max-h-72 w-full rounded-md bg-black"
                poster={att.thumbnailUrl || undefined}
              >
                <source src={att.url} />
              </video>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="truncate max-w-[200px]">{att.fileName}</span>
                <button
                  type="button"
                  onClick={() => openInNewTab(att.url)}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Download className="w-3 h-3" />
                  <span>Open</span>
                </button>
              </div>
            </div>
          )
        }

        return (
          <div
            key={key}
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {renderIcon(att.fileType)}
            <span className="truncate">{att.fileName}</span>
            {att.fileSize != null && (
              <span className="text-[11px] min-w-10 text-gray-500 dark:text-gray-400">
                {formatSize(att.fileSize)}
              </span>
            )}
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="w-6 h-6 min-w-0"
              onPress={() => openInNewTab(att.url)}
              aria-label={`Download ${att.fileName}`}
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
