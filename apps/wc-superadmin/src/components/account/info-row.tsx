'use client'

import React from 'react'
import { Button } from '@heroui/react'

interface InfoRowProps {
  label: string
  value: string | React.ReactNode
  hint?: string
  onEdit?: () => void
  badge?: React.ReactNode
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, hint, onEdit, badge }) => {
  return (
    <div className="flex items-center justify-between gap-4 py-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {badge}
        </div>
        <p className="text-slate-900 dark:text-white">{value}</p>
        {hint && <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{hint}</div>}
      </div>
      {onEdit && (
        <div className="shrink-0">
          <Button variant="light" className="underline" onPress={() => onEdit()}>
            Edit
          </Button>
        </div>
      )}
    </div>
  )
}
