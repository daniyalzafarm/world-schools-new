'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'
import { useChildrenStore } from '@/stores/children-store'
import { AddChildForm, type AddChildPayload } from '@/components/children/add-child-form-fields'

interface AddChildModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddChildModal({ isOpen, onClose }: AddChildModalProps) {
  const router = useRouter()
  const { addChild } = useChildrenStore()

  // Handle modal close
  const handleClose = () => onClose()

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" placement="center">
      <ModalContent>
        <ModalHeader className="text-xl font-semibold">Add a child</ModalHeader>
        <ModalBody className="gap-5">
          <AddChildForm
            submitLabel="Create profile"
            submitColor="secondary"
            onCancel={handleClose}
            onSubmit={async (payload: AddChildPayload) => {
              const success = await addChild(payload)
              if (!success) return null
              const children = useChildrenStore.getState().children
              return children[children.length - 1]
            }}
            onSuccess={newChild => {
              addToast({
                title: 'Success',
                description: 'Profile created! Complete the remaining sections to enable booking.',
                color: 'success',
              })
              onClose()
              router.push(`/children/${newChild.id}/profile`)
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
