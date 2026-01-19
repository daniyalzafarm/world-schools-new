'use client'

import React, { useCallback } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { EditorState } from 'lexical'
import { cn } from '../utils/cn'
import { ToolbarPlugin } from './rich-text-editor/toolbar-plugin'

export interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  isRequired?: boolean
  isInvalid?: boolean
  errorMessage?: string
  className?: string
  minHeight?: string
}

const theme = {
  paragraph: 'mb-2',
  quote: 'border-l-4 border-gray-300 pl-4 italic my-4',
  heading: {
    h1: 'text-3xl font-bold mb-4',
    h2: 'text-2xl font-bold mb-3',
    h3: 'text-xl font-bold mb-2',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal ml-4 mb-2',
    ul: 'list-disc ml-4 mb-2',
    listitem: 'mb-1',
  },
  link: 'text-primary-600 underline hover:text-primary-700',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
  },
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter text...',
  label,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  // Only pass editorState if value is a non-empty string
  // Otherwise, let Lexical create an empty editor state
  const editorState = value && value.trim() !== '' ? value : undefined

  const initialConfig = {
    namespace: 'RichTextEditor',
    theme,
    onError: (error: Error) => {
      console.error('Lexical error:', error)
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    editorState,
  }

  const handleChange = useCallback(
    (editorState: EditorState) => {
      editorState.read(() => {
        const json = JSON.stringify(editorState.toJSON())
        onChange?.(json)
      })
    },
    [onChange]
  )

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
          {isRequired && <span className="ml-1 text-danger">*</span>}
        </label>
      )}
      <LexicalComposer initialConfig={initialConfig}>
        <div
          className={cn(
            'relative rounded-lg border bg-white',
            isInvalid ? 'border-danger' : 'border-gray-200 hover:border-gray-300',
            'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
          )}
        >
          <ToolbarPlugin />
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    'relative min-h-[var(--min-height)] px-4 py-3',
                    'outline-none prose prose-sm max-w-none',
                    'dark:prose-invert'
                  )}
                  style={{ '--min-height': minHeight } as React.CSSProperties}
                />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
      </LexicalComposer>
      {isInvalid && errorMessage && (
        <p className="mt-1.5 text-sm text-danger">{errorMessage}</p>
      )}
    </div>
  )
}

