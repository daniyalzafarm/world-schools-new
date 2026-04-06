'use client'

import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { ActivitySection } from './ActivitySection'
import type { ActivityItem, MetaCard } from '../../types/camps'

export interface ActivitySectionData {
  key: string
  title: string
  icon: string
  description?: string
  items: ActivityItem[]
  metaCards?: MetaCard[]
  badges?: string[]
}

interface AllActivitiesModalProps {
  isOpen: boolean
  onClose: () => void
  sections: ActivitySectionData[]
}

export function AllActivitiesModal({ isOpen, onClose, sections }: AllActivitiesModalProps) {
  if (sections.length === 0) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'max-h-[90dvh]',
        header: 'border-b border-gray-100',
        body: 'px-6 py-0',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="px-6 pt-5 pb-4">
              <span className="text-xl font-bold text-gray-900">All activities</span>
            </ModalHeader>

            <ModalBody className="py-4">
              {sections.map(section => (
                <ActivitySection
                  key={section.key}
                  title={section.title}
                  icon={section.icon}
                  description={section.description}
                  metaCards={section.metaCards}
                  badges={section.badges}
                  items={section.items}
                  totalCount={section.items.length}
                  expandAll
                />
              ))}
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
