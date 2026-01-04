'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card, CardBody, Chip, Spinner, Tab, Tabs } from '@heroui/react'
import { EMOJI } from '@world-schools/wc-frontend-utils'
import { useApplicationReviewStore } from '../../../../stores/application-review-store'
import { ApprovalActions } from '../../../../components/application-review/ApprovalActions'
import { ContactInfoSection } from '../../../../components/application-review/ContactInfoSection'
import { GoogleBusinessSection } from '../../../../components/application-review/GoogleBusinessSection'
import { DocumentsSection } from '../../../../components/application-review/DocumentsSection'
import { SettingsSection } from '../../../../components/application-review/SettingsSection'
import { TrustScoreSection } from '../../../../components/application-review/TrustScoreSection'
import type { ApprovalStatus } from '../../../../types/application-review'

export default function ProviderRequestDetailPage() {
  const router = useRouter()
  const params = useParams()
  const providerId = params.id as string

  const { selectedApplication, isLoading, fetchApplicationDetail } = useApplicationReviewStore()
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    if (providerId) {
      fetchApplicationDetail(providerId).catch(error => {
        console.error('Failed to fetch application detail:', error)
      })
    }
  }, [providerId, fetchApplicationDetail])

  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'success'
      case 'rejected':
        return 'danger'
      case 'under_review':
        return 'primary'
      case 'info_requested':
        return 'warning'
      case 'suspended':
        return 'default'
      default:
        return 'warning'
    }
  }

  const getStatusLabel = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'under_review':
        return 'Under Review'
      case 'info_requested':
        return 'Info Requested'
      case 'suspended':
        return 'Suspended'
      default:
        return 'Pending'
    }
  }

  if (isLoading || !selectedApplication) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="light" onClick={() => router.push('/provider-requests')} className="mb-4">
          {EMOJI.ARROW_LEFT} Back to Provider Requests
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              {selectedApplication.businessName}
            </h1>
            <div className="flex items-center gap-4">
              <Chip
                size="lg"
                color={getStatusColor(selectedApplication.approvalStatus)}
                variant="flat"
              >
                {getStatusLabel(selectedApplication.approvalStatus)}
              </Chip>
              {selectedApplication.emailVerified && (
                <Chip size="sm" color="success" variant="flat">
                  {EMOJI.CHECK_MARK} Email Verified
                </Chip>
              )}
              {selectedApplication.phoneVerified && (
                <Chip size="sm" color="success" variant="flat">
                  {EMOJI.CHECK_MARK} Phone Verified
                </Chip>
              )}
            </div>
          </div>

          <ApprovalActions application={selectedApplication} />
        </div>
      </div>

      {/* Trust Score */}
      {selectedApplication.trustScore !== null && selectedApplication.trustScore !== undefined && (
        <TrustScoreSection application={selectedApplication} />
      )}

      {/* Tabs */}
      <Card>
        <CardBody>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={key => setSelectedTab(key as string)}
            aria-label="Application sections"
          >
            <Tab key="overview" title={`${EMOJI.DOCUMENT} Overview`}>
              <div className="space-y-6 py-4">
                <ContactInfoSection application={selectedApplication} />
                {selectedApplication.googleBusinessProfile && (
                  <GoogleBusinessSection profile={selectedApplication.googleBusinessProfile} />
                )}
                {selectedApplication.settings && (
                  <SettingsSection settings={selectedApplication.settings} />
                )}
              </div>
            </Tab>

            <Tab
              key="documents"
              title={`${EMOJI.SHIELD} Documents (${selectedApplication.documents.length})`}
            >
              <div className="py-4">
                <DocumentsSection
                  documents={selectedApplication.documents}
                  providerId={selectedApplication.id}
                />
              </div>
            </Tab>

            <Tab key="history" title={`${EMOJI.CLOCK} History`}>
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-default-200 p-4">
                  <h3 className="mb-2 font-semibold text-foreground">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-default-600">Account Created:</span>
                      <span className="text-foreground">
                        {new Date(selectedApplication.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {selectedApplication.onboardingStartedAt && (
                      <div className="flex justify-between">
                        <span className="text-default-600">Onboarding Started:</span>
                        <span className="text-foreground">
                          {new Date(selectedApplication.onboardingStartedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedApplication.onboardingCompletedAt && (
                      <div className="flex justify-between">
                        <span className="text-default-600">Onboarding Completed:</span>
                        <span className="text-foreground">
                          {new Date(selectedApplication.onboardingCompletedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedApplication.approvalDecisionAt && (
                      <div className="flex justify-between">
                        <span className="text-default-600">Decision Made:</span>
                        <span className="text-foreground">
                          {new Date(selectedApplication.approvalDecisionAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedApplication.rejectionReason && (
                  <div className="rounded-lg border border-danger bg-danger-50 p-4">
                    <h3 className="mb-2 font-semibold text-danger">Rejection Details</h3>
                    {selectedApplication.rejectionCategory && (
                      <div className="mb-2 text-sm font-medium text-danger">
                        Category: {selectedApplication.rejectionCategory}
                      </div>
                    )}
                    <p className="text-sm text-default-600">
                      {selectedApplication.rejectionReason}
                    </p>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  )
}
