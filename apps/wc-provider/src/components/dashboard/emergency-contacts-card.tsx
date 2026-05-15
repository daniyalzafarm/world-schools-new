import { Building2, Mail, Phone } from 'lucide-react'
import type { GoogleBusinessProfile } from '@/types/onboarding'

interface EmergencyContactsCardProps {
  businessProfile?: GoogleBusinessProfile | null
  fallbackEmail?: string | null
}

interface ContactRow {
  icon: React.ReactNode
  label: string
  value: string
}

export function EmergencyContactsCard({
  businessProfile,
  fallbackEmail,
}: EmergencyContactsCardProps) {
  const phone = businessProfile?.legalInfo?.providerPhone ?? businessProfile?.phone ?? null
  const email = businessProfile?.legalInfo?.providerEmail ?? fallbackEmail ?? null
  const name = businessProfile?.legalInfo?.legalCompanyName ?? businessProfile?.businessName ?? null
  const address = businessProfile?.formattedAddress ?? null

  const rows: ContactRow[] = []
  if (name) rows.push({ icon: <Building2 size={16} />, label: 'Business', value: name })
  if (phone) rows.push({ icon: <Phone size={16} />, label: 'Phone', value: phone })
  if (email) rows.push({ icon: <Mail size={16} />, label: 'Email', value: email })
  if (address) rows.push({ icon: <Building2 size={16} />, label: 'Address', value: address })

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-200 bg-default-50 p-6 text-center text-sm text-default-500">
        Add your business contact details in settings to display them here.
      </div>
    )
  }

  return (
    <ul className="divide-y divide-default-200 rounded-2xl border border-default-200 bg-background px-4">
      {rows.map(row => (
        <li key={row.label} className="flex items-start gap-3 py-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            {row.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-default-500">{row.label}</p>
            <p className="truncate text-sm font-medium text-foreground">{row.value}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
