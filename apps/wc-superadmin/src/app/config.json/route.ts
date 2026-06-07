import { NextResponse } from 'next/server'

import { getServerConfig } from '@/config/runtime-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json(getServerConfig(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
