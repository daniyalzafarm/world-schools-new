import { ComingSoon } from '@/components/ui/coming-soon'

export default function ChildHistoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Camp History</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Past camps and experiences</p>
      </div>
      <ComingSoon />
    </div>
  )
}
