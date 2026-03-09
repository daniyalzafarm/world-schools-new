'use client'

import React from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'

export type UnsavedChangesResult = 'save' | 'discard' | 'cancel'

interface UnsavedChangesDialogProps {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Modal
      isOpen={open}
      onOpenChange={isOpen => {
        if (!isOpen) onCancel()
      }}
      size="sm"
      classNames={{
        base: 'bg-white dark:bg-slate-800',
        wrapper: 'z-[9999]',
        backdrop: 'z-[9998] bg-black/50',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <TriangleAlert className="w-6 h-6 text-warning" />
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            Unsaved changes
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="text-slate-700 dark:text-slate-200 text-base">
            You have unsaved changes. Do you want to save before leaving?
          </div>
        </ModalBody>
        <ModalFooter className="flex flex-wrap gap-2">
          <Button variant="bordered" size="md" onPress={onCancel} className="min-w-24">
            Cancel
          </Button>
          <Button
            variant="bordered"
            color="warning"
            size="md"
            onPress={onDiscard}
            className="min-w-24"
          >
            Discard
          </Button>
          <Button variant="solid" color="primary" size="md" onPress={onSave} className="min-w-24">
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
