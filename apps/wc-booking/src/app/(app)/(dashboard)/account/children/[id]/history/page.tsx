import { BackButton } from '@world-schools/ui-web'
import { ComingSoon } from '@/components/ui/coming-soon'

export default function ChildHistoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <BackButton />
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Camp History</h1>
        </div>
        <p className="text-base text-gray-500 dark:text-gray-400">Past camps and experiences</p>
      </div>
      <ComingSoon />
    </div>
  )
}
