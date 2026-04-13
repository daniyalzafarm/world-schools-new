import { redirect } from 'next/navigation'

export default function AllProvidersPage() {
  redirect('/providers/pending-review')
}
