import { ComingSoon } from '@/components/ui/coming-soon'
import { PageSlot } from '@/components/layout/page-slot'

export default function UsersPage() {
  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users</h1>
        </header>
        <ComingSoon />
      </section>
    </PageSlot>
  )
}
