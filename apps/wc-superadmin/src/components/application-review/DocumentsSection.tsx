'use client'

import { useState } from 'react'
import {
  Button,
  Chip,
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
import type { DocumentReviewStatus, VerificationDocument } from '../../types/application-review'

interface DocumentsSectionProps {
  documents: VerificationDocument[]
  providerId: string
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  business_registration: 'Business Registration',
  insurance_certificate: 'Insurance Certificate',
  tax_document: 'Tax Document',
  other: 'Other',
}

export function DocumentsSection({ documents, providerId: _providerId }: DocumentsSectionProps) {
  const { reviewDocument, isLoading } = useApplicationReviewStore()
  const reviewModal = useDisclosure()

  const [selectedDocument, setSelectedDocument] = useState<VerificationDocument | null>(null)
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewStatus>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const handleReviewClick = (doc: VerificationDocument) => {
    setSelectedDocument(doc)
    setReviewStatus('approved')
    setReviewNotes('')
    setRejectionReason('')
    reviewModal.onOpen()
  }

  const handleSubmitReview = async () => {
    if (!selectedDocument) return

    await reviewDocument(selectedDocument.id, {
      reviewStatus,
      reviewNotes: reviewNotes || undefined,
      rejectionReason: reviewStatus === 'rejected' ? rejectionReason : undefined,
    })

    reviewModal.onClose()
    setSelectedDocument(null)
  }

  const getStatusColor = (status: DocumentReviewStatus) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'rejected':
        return 'danger'
      case 'needs_reupload':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: DocumentReviewStatus) => {
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'needs_reupload':
        return 'Needs Reupload'
      default:
        return 'Pending Review'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (documents.length === 0) {
    return (
      <div className="py-8 text-center text-default-400">
        <p>{EMOJI.DOCUMENT} No documents uploaded</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="flex items-start justify-between rounded-lg border border-default-200 p-4"
          >
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-foreground">{doc.fileName}</span>
                <Chip size="sm" color={getStatusColor(doc.reviewStatus)} variant="flat">
                  {getStatusLabel(doc.reviewStatus)}
                </Chip>
              </div>
              <div className="mb-2 flex items-center gap-4 text-sm text-default-500">
                <span>
                  {EMOJI.DOCUMENT} {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                </span>
                <span>{formatFileSize(doc.fileSizeBytes)}</span>
                <span>
                  {EMOJI.CALENDAR} {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              </div>
              {doc.reviewNotes && (
                <div className="mb-2 rounded-lg bg-default-50 p-2 text-sm text-default-600">
                  <strong>Review Notes:</strong> {doc.reviewNotes}
                </div>
              )}
              {doc.rejectionReason && (
                <div className="mb-2 rounded-lg bg-danger-50 p-2 text-sm text-danger">
                  <strong>Rejection Reason:</strong> {doc.rejectionReason}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                as="a"
                href={doc.fileUrl}
                target="_blank"
              >
                {EMOJI.DOWNLOAD} View
              </Button>
              {doc.reviewStatus === 'pending' && (
                <Button size="sm" color="primary" onPress={() => handleReviewClick(doc)}>
                  Review
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      <Modal isOpen={reviewModal.isOpen} onClose={reviewModal.onClose} size="lg">
        <ModalContent>
          <ModalHeader>Review Document</ModalHeader>
          <ModalBody>
            {selectedDocument && (
              <>
                <div className="mb-4">
                  <div className="text-sm text-default-600">Document</div>
                  <div className="font-medium text-foreground">{selectedDocument.fileName}</div>
                  <div className="text-sm text-default-500">
                    {DOCUMENT_TYPE_LABELS[selectedDocument.documentType]}
                  </div>
                </div>

                <Select
                  label="Review Decision"
                  selectedKeys={[reviewStatus]}
                  onSelectionChange={keys => {
                    const selected = Array.from(keys)[0] as DocumentReviewStatus
                    setReviewStatus(selected)
                  }}
                >
                  <SelectItem key="approved">Approved</SelectItem>
                  <SelectItem key="rejected">Rejected</SelectItem>
                  <SelectItem key="needs_reupload">Request Reupload</SelectItem>
                </Select>

                {reviewStatus === 'rejected' && (
                  <Textarea
                    label="Rejection Reason"
                    placeholder="Explain why this document is being rejected..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    minRows={3}
                    isRequired
                  />
                )}

                <Textarea
                  label="Review Notes (Optional)"
                  placeholder="Add any notes about this review..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  minRows={3}
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={reviewModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmitReview}
              isLoading={isLoading}
              isDisabled={reviewStatus === 'rejected' && !rejectionReason}
            >
              Submit Review
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
