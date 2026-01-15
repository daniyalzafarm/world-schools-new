'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button, Spinner } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useConfirmDialog } from '@world-schools/ui-web'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { DocumentType } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'

const DOCUMENT_TYPES: { value: DocumentType; label: string; required: boolean }[] = [
  { value: 'business_registration', label: 'Business Registration', required: true },
  { value: 'insurance_certificate', label: 'Insurance Certificate', required: true },
  { value: 'tax_document', label: 'Tax Document', required: false },
  { value: 'other', label: 'Other', required: false },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export default function OnboardingStep4Page() {
  const router = useRouter()
  const { status, documents, fetchDocuments, deleteDocument, completeStep4, isLoading } =
    useOnboardingStore()
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm } = useConfirmDialog()
  const fileInputRefs = useRef<Record<DocumentType, HTMLInputElement | null>>({
    business_registration: null,
    insurance_certificate: null,
    tax_document: null,
    other: null,
  })

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Route protection: Check if user can access Step 4
  useEffect(() => {
    if (status && !canAccessStep(4, status)) {
      const nextStep = getNextAccessibleStep(status)
      router.push(nextStep)
    }
  }, [status, router])

  useEffect(() => {
    fetchDocuments().catch(error => {
      console.error('Failed to fetch documents:', error)
    })
  }, [fetchDocuments])

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: DocumentType
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingType(docType)

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      addToast({
        title: 'File Too Large',
        description: 'File size must be less than 10MB',
        color: 'danger',
      })
      setUploadingType(null)
      return
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      addToast({
        title: 'Invalid File Type',
        description: 'Only PDF and image files (JPG, PNG) are allowed',
        color: 'danger',
      })
      setUploadingType(null)
      return
    }

    try {
      // Import the service directly to avoid store loading state
      const { onboardingService } = await import('../../../services/onboarding.services')
      await onboardingService.uploadDocument({ file, documentType: docType })

      // Refresh documents list
      await fetchDocuments()

      addToast({
        title: 'Success',
        description: 'Document uploaded successfully',
        color: 'success',
      })
    } catch (error: any) {
      addToast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload document. Please try again.',
        color: 'danger',
      })
    } finally {
      setUploadingType(null)

      // Reset file input
      const inputRef = fileInputRefs.current[docType]
      if (inputRef) {
        inputRef.value = ''
      }
    }
  }

  const handleDelete = async (documentId: string, fileName: string) => {
    const confirmed = await confirm({
      title: 'Delete Document?',
      message: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    setDeletingId(documentId)
    try {
      await deleteDocument(documentId)
      addToast({
        title: 'Success',
        description: 'Document deleted successfully',
        color: 'success',
      })
    } catch (error: any) {
      addToast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete document. Please try again.',
        color: 'danger',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const hasRequiredDocs = () => {
    const hasBusinessReg = documents.some(d => d.documentType === 'business_registration')
    const hasInsurance = documents.some(d => d.documentType === 'insurance_certificate')
    return hasBusinessReg && hasInsurance
  }

  const getDocumentForType = (type: DocumentType) => {
    return documents.find(d => d.documentType === type)
  }

  const handleContinue = async () => {
    try {
      await completeStep4()
      router.push('/onboarding/step-5')
    } catch (error) {
      console.error('Failed to complete step 4:', error)
      addToast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        color: 'danger',
      })
    }
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <OnboardingPageLayout
      breadcrumb="Provider Onboarding / Verification Documents"
      footer={
        <div className="flex items-center justify-between">
          <Button variant="light" onPress={() => router.push('/onboarding/step-3')}>
            ← Back
          </Button>
          <Button
            color="primary"
            size="lg"
            onPress={isReadOnly ? () => router.push('/onboarding/step-5') : handleContinue}
            isDisabled={!isReadOnly && !hasRequiredDocs()}
            isLoading={isLoading}
          >
            {isReadOnly ? 'Next →' : 'Save & Continue →'}
          </Button>
        </div>
      }
    >
      {/* Content */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-[32px] font-bold leading-tight text-foreground">
              Verification Documents
            </h1>
            <TrustScoreBadge section="step4" maxPoints={20} />
          </div>
          <p className="text-[16px] text-default-500">
            Upload documents to verify your camp and build trust with families
          </p>
        </div>

        {/* Required Documents */}
        <div className="mb-8">
          <h2 className="mb-4 text-[18px] font-semibold text-foreground">Required Documents</h2>
          <div className="space-y-4">
            {DOCUMENT_TYPES.filter(dt => dt.required).map(docType => {
              const doc = getDocumentForType(docType.value)
              const isUploading = uploadingType === docType.value

              return (
                <div
                  key={docType.value}
                  className="rounded-xl border border-default-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-[16px] font-semibold text-foreground">
                          {docType.label}
                        </h3>
                        <span className="text-danger">*</span>
                      </div>
                      {doc ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <Button
                                isIconOnly
                                variant="light"
                                color="danger"
                                size="sm"
                                onPress={() => handleDelete(doc.id, doc.fileName)}
                                isLoading={deletingId === doc.id}
                                isDisabled={isUploading}
                                className="min-w-6 w-6 h-6"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                            <span className="text-sm text-default-500">{doc.fileName}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-default-500">PDF or images only, max 10MB</p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={el => {
                            fileInputRefs.current[docType.value] = el
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => handleFileSelect(e, docType.value)}
                          className="hidden"
                        />
                        <Button
                          className="bg-primary font-semibold text-foreground hover:bg-primary-600"
                          onPress={() => fileInputRefs.current[docType.value]?.click()}
                          isLoading={isUploading}
                          isDisabled={deletingId === doc?.id}
                        >
                          {doc ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Optional Documents */}
        <div className="mb-8">
          <h2 className="mb-4 text-[18px] font-semibold text-foreground">
            Additional Documents (Optional)
          </h2>
          <div className="space-y-4">
            {DOCUMENT_TYPES.filter(dt => !dt.required).map(docType => {
              const doc = getDocumentForType(docType.value)
              const isUploading = uploadingType === docType.value

              return (
                <div
                  key={docType.value}
                  className="rounded-xl border border-default-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-2 text-[16px] font-semibold text-foreground">
                        {docType.label}
                      </h3>
                      {doc ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <Button
                                isIconOnly
                                variant="light"
                                color="danger"
                                size="sm"
                                onPress={() => handleDelete(doc.id, doc.fileName)}
                                isLoading={deletingId === doc.id}
                                isDisabled={isUploading}
                                className="min-w-6 w-6 h-6"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                            <span className="text-sm text-default-500">{doc.fileName}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-default-500">PDF or images only, max 10MB</p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-2">
                        <input
                          ref={el => {
                            fileInputRefs.current[docType.value] = el
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={e => handleFileSelect(e, docType.value)}
                          className="hidden"
                        />
                        <Button
                          className="bg-primary font-semibold text-foreground hover:bg-primary-600"
                          onPress={() => fileInputRefs.current[docType.value]?.click()}
                          isLoading={isUploading}
                          isDisabled={deletingId === doc?.id}
                        >
                          {doc ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </OnboardingPageLayout>
  )
}
