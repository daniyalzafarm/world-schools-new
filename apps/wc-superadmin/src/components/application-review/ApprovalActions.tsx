'use client'

import { useState } from 'react'
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { EMOJI } from '@world-schools/wc-frontend-utils'
import { useApplicationReviewStore } from '../../stores/application-review-store'
import type { ApplicationDetail } from '../../types/application-review'

interface ApprovalActionsProps {
  application: ApplicationDetail
}

const REJECTION_CATEGORIES = [
  { value: 'incomplete_information', label: 'Incomplete Information' },
  { value: 'invalid_documents', label: 'Invalid Documents' },
  { value: 'failed_verification', label: 'Failed Verification' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'other', label: 'Other' },
]

export function ApprovalActions({ application }: ApprovalActionsProps) {
  const { approveApplication, rejectApplication, requestInfo, isLoading } =
    useApplicationReviewStore()

  const approveModal = useDisclosure()
  const rejectModal = useDisclosure()
  const requestInfoModal = useDisclosure()

  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionCategory, setRejectionCategory] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const handleApprove = async () => {
    await approveApplication(application.id, { notes: approvalNotes })
    approveModal.onClose()
    setApprovalNotes('')
  }

  const handleReject = async () => {
    if (!rejectionReason || !rejectionCategory) return
    await rejectApplication(application.id, {
      reason: rejectionReason,
      category: rejectionCategory,
    })
    rejectModal.onClose()
    setRejectionReason('')
    setRejectionCategory('')
  }

  const handleRequestInfo = async () => {
    if (!infoMessage) return
    await requestInfo(application.id, { message: infoMessage })
    requestInfoModal.onClose()
    setInfoMessage('')
  }

  // Don't show actions if already approved or rejected
  if (application.approvalStatus === 'approved' || application.approvalStatus === 'rejected') {
    return null
  }

  return (
    <>
      <div className="flex gap-2">
        <Button color="warning" variant="flat" onClick={requestInfoModal.onOpen}>
          {EMOJI.QUESTION} Request Info
        </Button>
        <Button color="danger" variant="flat" onClick={rejectModal.onOpen}>
          {EMOJI.CROSS_MARK} Reject
        </Button>
        <Button color="success" onClick={approveModal.onOpen}>
          {EMOJI.CHECK_MARK} Approve
        </Button>
      </div>

      {/* Approve Modal */}
      <Modal isOpen={approveModal.isOpen} onClose={approveModal.onClose}>
        <ModalContent>
          <ModalHeader>Approve Application</ModalHeader>
          <ModalBody>
            <p className="mb-4 text-default-600">
              Are you sure you want to approve this provider application?
            </p>
            <Textarea
              label="Notes (Optional)"
              placeholder="Add any notes about this approval..."
              value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={approveModal.onClose}>
              Cancel
            </Button>
            <Button color="success" onClick={handleApprove} isLoading={isLoading}>
              {EMOJI.CHECK_MARK} Approve
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.isOpen} onClose={rejectModal.onClose}>
        <ModalContent>
          <ModalHeader>Reject Application</ModalHeader>
          <ModalBody>
            <p className="mb-4 text-default-600">
              Please provide a reason for rejecting this application.
            </p>
            <Select
              label="Rejection Category"
              placeholder="Select a category"
              selectedKeys={rejectionCategory ? [rejectionCategory] : []}
              onChange={e => setRejectionCategory(e.target.value)}
              isRequired
            >
              {REJECTION_CATEGORIES.map(cat => (
                <SelectItem key={cat.value}>{cat.label}</SelectItem>
              ))}
            </Select>
            <Textarea
              label="Rejection Reason"
              placeholder="Explain why this application is being rejected..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              minRows={4}
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={rejectModal.onClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={handleReject}
              isLoading={isLoading}
              isDisabled={!rejectionReason || !rejectionCategory}
            >
              {EMOJI.CROSS_MARK} Reject
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Request Info Modal */}
      <Modal isOpen={requestInfoModal.isOpen} onClose={requestInfoModal.onClose}>
        <ModalContent>
          <ModalHeader>Request Additional Information</ModalHeader>
          <ModalBody>
            <p className="mb-4 text-default-600">
              Request additional information from the provider.
            </p>
            <Textarea
              label="Message to Provider"
              placeholder="Describe what additional information is needed..."
              value={infoMessage}
              onChange={e => setInfoMessage(e.target.value)}
              minRows={4}
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={requestInfoModal.onClose}>
              Cancel
            </Button>
            <Button
              color="warning"
              onClick={handleRequestInfo}
              isLoading={isLoading}
              isDisabled={!infoMessage}
            >
              {EMOJI.QUESTION} Request Info
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
