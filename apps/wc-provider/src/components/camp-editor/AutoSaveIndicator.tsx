'use client'

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
          <span className="text-default-600">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <div className="h-2 w-2 rounded-full bg-success-500" />
          <span className="text-default-600">All changes saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="h-2 w-2 rounded-full bg-danger-500" />
          <span className="text-danger-600">Failed to save</span>
        </>
      )}
    </div>
  )
}
