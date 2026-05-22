'use client'

import { Button, Card, CardBody, CardHeader, Spinner } from '@heroui/react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  className?: string
  bodyClassName?: string
  empty?: boolean
  emptyMessage?: string
}

export function ChartCard({
  title,
  description,
  actions,
  children,
  loading = false,
  error = null,
  onRetry,
  className = '',
  bodyClassName = '',
  empty = false,
  emptyMessage = 'No data in this range.',
}: ChartCardProps) {
  return (
    <Card shadow="sm" className={`border border-default-200 ${className}`}>
      <CardHeader className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-default-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardBody className={`pt-0 ${bodyClassName}`}>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner color="primary" />
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <TriangleAlert className="h-8 w-8 text-danger" />
            <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            {onRetry && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<RefreshCw className="h-4 w-4" />}
                onPress={onRetry}
              >
                Retry
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="flex h-48 flex-col items-center justify-center text-sm text-default-500">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardBody>
    </Card>
  )
}
