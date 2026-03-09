'use client'

import { Card, CardBody } from '@heroui/react'
import type { ReactNode } from 'react'

interface ArticleEditorSettingsPanelProps {
  children: ReactNode
}

export function ArticleEditorSettingsPanel({ children }: ArticleEditorSettingsPanelProps) {
  return (
    <Card className="border-0 shadow-none">
      <CardBody className="gap-4 p-5">{children}</CardBody>
    </Card>
  )
}
