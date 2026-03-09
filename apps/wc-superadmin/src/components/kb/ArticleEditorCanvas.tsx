'use client'

import type { ReactNode } from 'react'

interface ArticleEditorCanvasProps {
  children: ReactNode
}

export function ArticleEditorCanvas({ children }: ArticleEditorCanvasProps) {
  return <div className="mx-auto w-full max-w-[740px]">{children}</div>
}
