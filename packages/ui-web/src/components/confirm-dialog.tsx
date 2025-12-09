'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'

interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined)

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return ctx
}

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmDialogOptions>({ message: '' })
  const resolver = useRef<((result: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
    })
  }, [])

  const handleClose = (result: boolean) => {
    setOpen(false)
    resolver.current?.(result)
    resolver.current = null
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={open}
        {...options}
        onConfirm={() => handleClose(true)}
        onCancel={() => handleClose(false)}
      />
    </ConfirmDialogContext.Provider>
  )
}

const ConfirmDialog: React.FC<{
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}> = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}) => {
  const getIconColor = () => {
    switch (variant) {
      case 'danger':
        return 'text-danger'
      case 'warning':
        return 'text-warning'
      case 'info':
        return 'text-primary'
      default:
        return 'text-warning'
    }
  }

  const getConfirmButtonColor = () => {
    switch (variant) {
      case 'danger':
        return 'danger'
      case 'warning':
        return 'warning'
      case 'info':
        return 'primary'
      default:
        return 'primary'
    }
  }

  return (
    <Modal
      isOpen={open}
      onOpenChange={onCancel}
      size="sm"
      classNames={{ base: 'bg-white dark:bg-slate-800' }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <TriangleAlert className={`w-6 h-6 ${getIconColor()}`} />
          <span className="text-lg font-semibold text-slate-900 dark:text-white">
            {title || 'Are you sure?'}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="text-slate-700 dark:text-slate-200 text-base whitespace-pre-line">
            {message}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="bordered" size="md" onPress={onCancel} className="min-w-24">
            {cancelText}
          </Button>
          <Button
            variant="solid"
            color={getConfirmButtonColor()}
            size="md"
            onPress={onConfirm}
            className="min-w-24"
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

