'use client'

import { useParams } from 'next/navigation'
import { SessionsPage } from '@/components/sessions'

/**
 * Camp Editor - Sessions Page
 * Allows providers to manage camp sessions
 */
export default function EditorSessionsPage() {
  const params = useParams()
  const campId = params.campId as string

  return <SessionsPage campId={campId} />
}
