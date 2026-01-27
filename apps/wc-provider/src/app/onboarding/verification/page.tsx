'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button, Checkbox, Chip, Input, Spinner } from '@heroui/react'
import { Trash2, Upload } from 'lucide-react'
import { DocumentDropzone, useConfirmDialog } from '@world-schools/ui-web'
import { useOnboardingStore } from '../../../stores/onboarding-store'
import { OnboardingPageLayout } from '../../../components/onboarding/OnboardingPageLayout'
import { OnboardingFooter } from '../../../components/onboarding/OnboardingFooter'
import { TrustScoreBadge } from '../../../components/onboarding/TrustScoreBadge'
import type { DocumentType } from '../../../types/onboarding'
import { canAccessStep, getNextAccessibleStep } from '../../../utils/onboarding-access'

// Document type definitions
interface DocumentConfig {
  value: DocumentType
  label: string
  description: string
  required?: boolean
  highlighted?: boolean
  region?: 'us' | 'international' | 'all'
  allowCustomTitle?: boolean
}

const REQUIRED_DOCUMENTS: DocumentConfig[] = [
  {
    value: 'business_registration',
    label: 'Business Registration',
    description: 'Trade license, incorporation certificate, or official business registration',
    required: true,
  },
  {
    value: 'insurance_certificate',
    label: 'Insurance Certificate',
    description: 'Liability insurance with minimum €1,000,000 coverage, valid for at least 60 days',
    required: true,
  },
]

const ACCREDITATIONS: DocumentConfig[] = [
  {
    value: 'aca',
    label: 'ACA (American Camp Association)',
    description: 'Accreditation covering 300+ health and safety standards',
    highlighted: true,
    region: 'us',
  },
  {
    value: 'icf',
    label: 'ICF (International Camping Fellowship)',
    description: 'Global camping organization with members in 90+ countries',
    highlighted: true,
    region: 'international',
  },
  {
    value: 'bsa',
    label: 'BSA (Boy Scouts of America)',
    description: 'Licensed BSA camp or program',
    region: 'all',
  },
  {
    value: 'national_accreditation',
    label: 'National Camp Association',
    description: "Your country's official camping organization membership",
    region: 'all',
  },
  {
    value: 'regional_accreditation',
    label: 'Regional / Local Accreditation',
    description: 'State, province, or local camp certification',
    region: 'all',
  },
  {
    value: 'other_accreditation',
    label: 'Other Accreditation',
    description: 'Add any other industry accreditation not listed above',
    allowCustomTitle: true,
    region: 'all',
  },
]

const SAFETY_CERTIFICATIONS: DocumentConfig[] = [
  {
    value: 'risk_policy',
    label: 'Written Risk & Safety Policy',
    description: 'Documented safety procedures and risk management protocols',
  },
  {
    value: 'first_aid',
    label: 'Staff First Aid / CPR Training',
    description: 'Certified first aid and CPR trained staff members',
  },
  {
    value: 'lifeguard',
    label: 'Certified Lifeguards',
    description: 'Required if your camp offers swimming or water activities',
  },
  {
    value: 'background_check',
    label: 'Staff Background Checks',
    description: 'Criminal background verification for all staff members',
  },
  {
    value: 'emergency_plan',
    label: 'Emergency Action Plan',
    description: 'Documented emergency procedures and evacuation protocols',
  },
  {
    value: 'food_safety',
    label: 'Food Handling Certification',
    description: 'Certified food safety and handling procedures',
  },
  {
    value: 'other_safety',
    label: 'Other Safety Certification',
    description: 'Add any other safety certification not listed above',
    allowCustomTitle: true,
  },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export default function OnboardingStep4Page() {
  const router = useRouter()
  const {
    status,
    documents,
    fetchDocuments,
    deleteDocument,
    completeStep4,
    uploadDocument,
    isLoading,
    googleBusinessProfile,
  } = useOnboardingStore()
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<Set<DocumentType>>(new Set())
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({})
  const { confirm } = useConfirmDialog()
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Check if onboarding is completed (read-only mode)
  const isReadOnly = status?.isCompleted ?? false

  // Determine if camp is in US based on Google Business Profile
  const isUSCamp = googleBusinessProfile?.country === 'US'

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

  // Initialize selected docs based on existing documents
  useEffect(() => {
    const selected = new Set<DocumentType>()
    const titles: Record<string, string> = {}

    documents.forEach(doc => {
      selected.add(doc.documentType)
      if (doc.customTitle) {
        titles[doc.documentType] = doc.customTitle
      }
    })

    setSelectedDocs(selected)
    setCustomTitles(titles)
  }, [documents])

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: DocumentType,
    customTitle?: string
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

    // Use the store method which handles errors internally
    await uploadDocument(file, docType, customTitle)

    // Check if upload was successful (store will have set error if it failed)
    const currentStore = useOnboardingStore.getState()
    if (currentStore.error) {
      addToast({
        title: 'Upload Failed',
        description: currentStore.error,
        color: 'danger',
      })
    } else {
      addToast({
        title: 'Success',
        description: 'Document uploaded successfully',
        color: 'success',
      })
    }

    setUploadingType(null)

    // Reset file input
    const inputRef = fileInputRefs.current[docType]
    if (inputRef) {
      inputRef.value = ''
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
      router.push('/onboarding/payment-policies')
    } catch (error) {
      console.error('Failed to complete step 4:', error)
      addToast({
        title: 'Error',
        description: 'Failed to save progress. Please try again.',
        color: 'danger',
      })
    }
  }

  const toggleDocSelection = (docType: DocumentType) => {
    if (isReadOnly) return

    const newSelected = new Set(selectedDocs)
    if (newSelected.has(docType)) {
      newSelected.delete(docType)
      // Clear custom title if deselecting
      const newTitles = { ...customTitles }
      delete newTitles[docType]
      setCustomTitles(newTitles)
    } else {
      newSelected.add(docType)
    }
    setSelectedDocs(newSelected)
  }

  const handleCustomTitleChange = (docType: DocumentType, title: string) => {
    setCustomTitles(prev => ({
      ...prev,
      [docType]: title,
    }))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const filterAccreditationsByRegion = (accreditations: DocumentConfig[]) => {
    return accreditations.filter(acc => {
      if (acc.region === 'all') return true
      if (acc.region === 'us') return isUSCamp
      if (acc.region === 'international') return !isUSCamp
      return true
    })
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
        <OnboardingFooter
          onNext={async () => {
            if (isReadOnly || status?.stepCompletion.step4) {
              // Step already completed or read-only mode - navigate directly without saving
              router.push('/onboarding/payment-policies')
            } else {
              // Step not completed - complete it first, then navigate
              await handleContinue()
            }
          }}
          isLoading={isLoading}
          isDisabled={!isReadOnly && !status?.stepCompletion.step4 && !hasRequiredDocs()}
          nextButtonText={
            isReadOnly || status?.stepCompletion.step4 ? 'Next →' : 'Save & Continue →'
          }
        />
      }
    >
      {/* Content */}
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Verification Documents
            </h1>
            <TrustScoreBadge section="step4" maxPoints={20} />
          </div>
          <p className="text-base text-default-500">
            Upload documents to verify your camp and build trust with families
          </p>
        </div>

        {/* Required Documents */}
        <div className="mb-8">
          <h2 className="flex items-center gap-2 mb-1 text-lg font-semibold text-foreground">
            Business Documents{' '}
            <Chip size="sm" color="danger" variant="flat">
              Required
            </Chip>
          </h2>
          <p className="mb-4 text-sm text-default-500">
            These documents are required to continue to the next step
          </p>
          <div className="space-y-4">
            {REQUIRED_DOCUMENTS.map(docConfig => {
              const doc = getDocumentForType(docConfig.value)
              const isUploading = uploadingType === docConfig.value

              return (
                <div
                  key={docConfig.value}
                  className="rounded-xl border border-default-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {docConfig.label}
                        </h3>
                        <span className="text-danger">*</span>
                      </div>
                      <p className="mb-3 text-sm text-default-500">{docConfig.description}</p>

                      {doc ? (
                        <div className="flex justify-between items-center">
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
                            <span className="text-xs text-default-400">
                              ({formatFileSize(doc.fileSizeBytes)})
                            </span>
                          </div>
                          {!isReadOnly && (
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              onPress={() => fileInputRefs.current[docConfig.value]?.click()}
                              isLoading={isUploading}
                              isDisabled={deletingId === doc?.id}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Replace Document
                            </Button>
                          )}
                        </div>
                      ) : !isReadOnly ? (
                        <DocumentDropzone
                          onFileSelect={file => {
                            const event = {
                              target: { files: [file] },
                            } as unknown as React.ChangeEvent<HTMLInputElement>
                            handleFileSelect(event, docConfig.value).catch(error => {
                              console.error('Failed to upload file:', error)
                            })
                          }}
                          isUploading={isUploading}
                        />
                      ) : (
                        <p className="text-sm text-default-500">No document uploaded</p>
                      )}

                      <input
                        ref={el => {
                          fileInputRefs.current[docConfig.value] = el
                        }}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => handleFileSelect(e, docConfig.value)}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Accreditations Section */}
        <div className="mb-8">
          <h2 className="flex items-center gap-2 mb-1 text-lg font-semibold text-foreground">
            Industry Accreditations{' '}
            <Chip size="sm" color="success" variant="flat">
              Optional
            </Chip>
          </h2>
          <p className="mb-4 text-sm text-default-500">
            Accredited camps receive significantly higher visibility and trust from families.
          </p>
          <div className="space-y-4">
            {filterAccreditationsByRegion(ACCREDITATIONS).map(docConfig => {
              const doc = getDocumentForType(docConfig.value)
              const isSelected = selectedDocs.has(docConfig.value)
              const isUploading = uploadingType === docConfig.value
              const needsCustomTitle = docConfig.allowCustomTitle && isSelected && !doc

              return (
                <div
                  key={docConfig.value}
                  className={`rounded-xl border p-6 ${
                    docConfig.highlighted
                      ? 'border-warning/30 bg-warning/5'
                      : 'border-default-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      isSelected={isSelected || !!doc}
                      onValueChange={() => toggleDocSelection(docConfig.value)}
                      isDisabled={isReadOnly || !!doc}
                      className="mt-1"
                      color={docConfig.highlighted ? 'warning' : 'primary'}
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="flex gap-2 items-center text-base font-semibold text-foreground">
                            {docConfig.label}
                            {docConfig.highlighted && (
                              <Chip size="sm" color="warning" variant="flat">
                                Recommended
                              </Chip>
                            )}
                          </h3>
                          <p className="mt-1 text-sm text-default-500">{docConfig.description}</p>
                        </div>
                        <Chip size="sm" color={doc ? 'success' : 'default'} variant="flat">
                          {doc ? 'Uploaded' : 'Not Uploaded'}
                        </Chip>
                      </div>

                      {needsCustomTitle && (
                        <div className="mt-4">
                          <Input
                            label="Accreditation Name"
                            placeholder="e.g., State Youth Camp License"
                            value={customTitles[docConfig.value] || ''}
                            onValueChange={value => handleCustomTitleChange(docConfig.value, value)}
                            size="sm"
                            isDisabled={isReadOnly}
                          />
                        </div>
                      )}

                      {doc ? (
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <span className="text-sm font-medium text-success">
                                {doc.fileName.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              {doc.customTitle && (
                                <p className="text-xs font-medium text-default-600">
                                  {doc.customTitle}
                                </p>
                              )}
                              <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                              <p className="text-xs text-default-500">
                                {formatFileSize(doc.fileSizeBytes)}
                              </p>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => handleDelete(doc.id, doc.fileName)}
                              isLoading={deletingId === doc.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : isSelected ? (
                        <>
                          <input
                            ref={el => {
                              fileInputRefs.current[docConfig.value] = el
                            }}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e =>
                              handleFileSelect(e, docConfig.value, customTitles[docConfig.value])
                            }
                            disabled={isReadOnly}
                          />
                          <div className="mt-4">
                            <DocumentDropzone
                              onFileSelect={file => {
                                if (needsCustomTitle && !customTitles[docConfig.value]) {
                                  addToast({
                                    title: 'Custom Title Required',
                                    description: 'Please enter a name for this accreditation',
                                    color: 'warning',
                                  })
                                  return
                                }
                                const event = {
                                  target: { files: [file] },
                                } as unknown as React.ChangeEvent<HTMLInputElement>
                                handleFileSelect(
                                  event,
                                  docConfig.value,
                                  customTitles[docConfig.value]
                                ).catch(error => {
                                  console.error('Failed to upload file:', error)
                                })
                              }}
                              isUploading={isUploading}
                              isDisabled={isReadOnly}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Safety Certifications Section */}
        <div className="mb-8">
          <h2 className="flex items-center gap-2 mb-1 text-lg font-semibold text-foreground">
            Safety Certifications{' '}
            <Chip size="sm" color="success" variant="flat">
              Optional
            </Chip>
          </h2>
          <p className="mb-4 text-sm text-default-500">
            Select certifications your organization holds and upload supporting documents.
          </p>
          <div className="space-y-4">
            {SAFETY_CERTIFICATIONS.map(docConfig => {
              const doc = getDocumentForType(docConfig.value)
              const isSelected = selectedDocs.has(docConfig.value)
              const isUploading = uploadingType === docConfig.value
              const needsCustomTitle = docConfig.allowCustomTitle && isSelected && !doc

              return (
                <div
                  key={docConfig.value}
                  className="rounded-xl border border-default-200 bg-white p-6"
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      isSelected={isSelected || !!doc}
                      onValueChange={() => toggleDocSelection(docConfig.value)}
                      isDisabled={isReadOnly || !!doc}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-foreground">
                            {docConfig.label}
                          </h3>
                          <p className="mt-1 text-sm text-default-500">{docConfig.description}</p>
                        </div>
                        <Chip size="sm" color={doc ? 'success' : 'default'} variant="flat">
                          {doc ? 'Uploaded' : 'Not Uploaded'}
                        </Chip>
                      </div>

                      {needsCustomTitle && (
                        <div className="mt-4">
                          <Input
                            label="Certification Name"
                            placeholder="e.g., Wilderness First Aid"
                            value={customTitles[docConfig.value] || ''}
                            onValueChange={value => handleCustomTitleChange(docConfig.value, value)}
                            size="sm"
                            isDisabled={isReadOnly}
                          />
                        </div>
                      )}

                      {doc ? (
                        <div className="mt-4 flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                              <span className="text-sm font-medium text-success">
                                {doc.fileName.split('.').pop()?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              {doc.customTitle && (
                                <p className="text-xs font-medium text-default-600">
                                  {doc.customTitle}
                                </p>
                              )}
                              <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                              <p className="text-xs text-default-500">
                                {formatFileSize(doc.fileSizeBytes)}
                              </p>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => handleDelete(doc.id, doc.fileName)}
                              isLoading={deletingId === doc.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : isSelected ? (
                        <>
                          <input
                            ref={el => {
                              fileInputRefs.current[docConfig.value] = el
                            }}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e =>
                              handleFileSelect(e, docConfig.value, customTitles[docConfig.value])
                            }
                            disabled={isReadOnly}
                          />
                          <div className="mt-4">
                            <DocumentDropzone
                              onFileSelect={file => {
                                if (needsCustomTitle && !customTitles[docConfig.value]) {
                                  addToast({
                                    title: 'Custom Title Required',
                                    description: 'Please enter a name for this certification',
                                    color: 'warning',
                                  })
                                  return
                                }
                                const event = {
                                  target: { files: [file] },
                                } as unknown as React.ChangeEvent<HTMLInputElement>
                                handleFileSelect(
                                  event,
                                  docConfig.value,
                                  customTitles[docConfig.value]
                                ).catch(error => {
                                  console.error('Failed to upload file:', error)
                                })
                              }}
                              isUploading={isUploading}
                              isDisabled={isReadOnly}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
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
