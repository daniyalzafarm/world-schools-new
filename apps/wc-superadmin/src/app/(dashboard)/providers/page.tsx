import { PageSlot } from '@/components/layout/page-slot'
import { AllProvidersView } from '@/components/providers/providers-view'

export default function AllProvidersPage() {
  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">All Providers</h1>
            <p className="mt-1 text-slate-500">Manage camp providers and their applications</p>
          </div>
        </header>
        <AllProvidersView />
      </section>
    </PageSlot>
  )
}
