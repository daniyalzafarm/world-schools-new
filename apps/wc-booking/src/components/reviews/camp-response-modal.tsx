'use client'

import React from 'react'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import type { CampReviewResponse } from '@/types/reviews'

interface CampResponseModalProps {
  isOpen: boolean
  onClose: () => void
  campName: string
  response: CampReviewResponse
}

export const CampResponseModal: React.FC<CampResponseModalProps> = ({
  isOpen,
  onClose,
  campName,
  response,
}) => {
  const initials = campName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const formattedDate = new Date(response.createdAt).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" placement="center">
      <ModalContent>
        <ModalHeader className="pb-2">
          <span className="text-base font-semibold text-slate-900 dark:text-white">
            Camp Response
          </span>
        </ModalHeader>
        <ModalBody className="pb-6">
          {/* Responder meta */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                {initials}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{campName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Responded {formattedDate}
              </p>
            </div>
          </div>

          {/* Response text */}
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {response.responseText}
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
