'use client'

import { EMOJI } from '@world-schools/wc-frontend-utils'
import type { ApplicationDetail } from '../../types/application-review'

interface ContactInfoSectionProps {
  application: ApplicationDetail
}

export function ContactInfoSection({ application }: ContactInfoSectionProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information */}
      <div className="rounded-lg border border-default-200 p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          {EMOJI.USER} Contact Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-default-600">Contact Name</div>
            <div className="text-foreground">
              {application.contactFirstName} {application.contactLastName}
            </div>
          </div>
          <div>
            <div className="text-sm text-default-600">Role/Title</div>
            <div className="text-foreground">{application.contactRole ?? 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-default-600">Email</div>
            <div className="text-foreground">{application.email}</div>
          </div>
          <div>
            <div className="text-sm text-default-600">Phone</div>
            <div className="text-foreground">
              {application.contactPhoneCountryCode && application.contactPhone
                ? `${application.contactPhoneCountryCode} ${application.contactPhone}`
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Legal Business Information */}
      <div className="rounded-lg border border-default-200 p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          {EMOJI.DOCUMENT} Legal Business Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-default-600">Legal Company Name</div>
            <div className="text-foreground">{application.legalCompanyName ?? 'N/A'}</div>
          </div>
          <div>
            <div className="text-sm text-default-600">Year Founded</div>
            <div className="text-foreground">{application.yearFounded ?? 'N/A'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-sm text-default-600">Business Address</div>
            <div className="text-foreground">
              {application.legalStreetAddress
                ? `${application.legalStreetAddress}${application.legalAptSuite ? `, ${application.legalAptSuite}` : ''}, ${application.legalCity}, ${application.legalStateProvince} ${application.legalPostalCode}, ${application.legalCountry}`
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
