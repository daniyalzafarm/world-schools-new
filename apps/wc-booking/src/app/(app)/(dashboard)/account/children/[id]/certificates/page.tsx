import { BackButton } from '@world-schools/ui-web'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function ChildCertificatesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <BackButton />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Certificates</h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">
          Achievements and certifications earned at camps
        </p>
      </div>
      <ComingSoon />
    </div>
  )
}
