'use client'

import { type ReactNode, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ArticleEditorTopBar } from '@/components/kb/ArticleEditorTopBar'

function getEditorMode(pathname: string | null): 'create' | 'edit' | null {
  if (!pathname) return null
  if (pathname.endsWith('/create')) return 'create'
  if (pathname.endsWith('/edit')) return 'edit'
  return null
}

export default function CatalogueActivitiesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const mode = useMemo(() => getEditorMode(pathname), [pathname])

  if (!mode) return <>{children}</>

  const title = mode === 'edit' ? 'Edit Activity' : 'Create Activity'

  return (
    <div className="flex h-full flex-col bg-default-50">
      <div className="sticky top-0 z-20 shrink-0">
        <ArticleEditorTopBar
          title={title}
          breadcrumb="Activity Catalogue"
          onBackClick={() => router.push('/catalogue')}
          actions={
            <>
              <Button variant="flat" onPress={() => router.push('/catalogue')}>
                Cancel
              </Button>
              <Button
                color="primary"
                type="submit"
                form="catalogue-activity-form"
                name="submitAction"
                value="save"
              >
                {mode === 'edit' ? 'Save Changes' : 'Create Activity'}
              </Button>
            </>
          }
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl">
          <div className="px-4 py-6 lg:px-10 lg:py-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
