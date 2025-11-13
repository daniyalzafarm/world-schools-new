import { ComingSoon } from '@/components/ui/coming-soon'

export default function NotificationsPage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Notifications</h1>
      </header>
      <ComingSoon />
    </section>
  )
}
