'use client'

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ArticleStatus } from '@world-schools/wc-frontend-utils'

interface ArticleEditorTopBarConfig {
  title: string
  breadcrumb?: string
  status?: ArticleStatus
  actions?: ReactNode
  onBackClick?: () => void
}

interface ArticleEditorLayoutContextType {
  rightSidebar: ReactNode | null
  setRightSidebar: (sidebar: ReactNode | null) => void
  topBarConfig: ArticleEditorTopBarConfig
  setTopBarConfig: (config: Partial<ArticleEditorTopBarConfig>) => void
  resetTopBarConfig: () => void
}

const defaultTopBarConfig: ArticleEditorTopBarConfig = {
  title: 'Article Editor',
  breadcrumb: 'Knowledge Base',
}

function isTopBarConfigEqual(a: ArticleEditorTopBarConfig, b: ArticleEditorTopBarConfig): boolean {
  return (
    a.title === b.title &&
    a.breadcrumb === b.breadcrumb &&
    a.status === b.status &&
    a.actions === b.actions &&
    a.onBackClick === b.onBackClick
  )
}

const ArticleEditorLayoutContext = createContext<ArticleEditorLayoutContextType | undefined>(
  undefined
)

export function ArticleEditorLayoutProvider({ children }: { children: ReactNode }) {
  const [rightSidebarState, setRightSidebarState] = useState<ReactNode | null>(null)
  const [topBarConfig, setTopBarConfigState] =
    useState<ArticleEditorTopBarConfig>(defaultTopBarConfig)

  const setTopBarConfig = useCallback((config: Partial<ArticleEditorTopBarConfig>) => {
    setTopBarConfigState(prev => {
      const next = { ...prev, ...config }
      if (isTopBarConfigEqual(prev, next)) {
        return prev
      }
      return next
    })
  }, [])

  const resetTopBarConfig = useCallback(() => {
    setTopBarConfigState(prev => {
      if (isTopBarConfigEqual(prev, defaultTopBarConfig)) {
        return prev
      }
      return defaultTopBarConfig
    })
  }, [])

  const setRightSidebar = useCallback((sidebar: ReactNode | null) => {
    setRightSidebarState(prev => {
      if (prev === sidebar) {
        return prev
      }
      return sidebar
    })
  }, [])

  const value = useMemo(
    () => ({
      rightSidebar: rightSidebarState,
      setRightSidebar,
      topBarConfig,
      setTopBarConfig,
      resetTopBarConfig,
    }),
    [rightSidebarState, setRightSidebar, topBarConfig, setTopBarConfig, resetTopBarConfig]
  )

  return (
    <ArticleEditorLayoutContext.Provider value={value}>
      {children}
    </ArticleEditorLayoutContext.Provider>
  )
}

export function useArticleEditorLayout() {
  const context = useContext(ArticleEditorLayoutContext)
  if (context === undefined) {
    throw new Error('useArticleEditorLayout must be used within an ArticleEditorLayoutProvider')
  }
  return context
}

export function useArticleEditorLayoutOptional() {
  return useContext(ArticleEditorLayoutContext)
}
