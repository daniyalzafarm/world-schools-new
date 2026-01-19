'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useState } from 'react'
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text'
import { $createParagraphNode } from 'lexical'
import { Bold, Italic, Underline, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react'
import { cn } from '../../utils/cn'

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
    }
  }, [])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar()
      })
    })
  }, [editor, updateToolbar])

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize))
      }
    })
  }

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode())
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2">
      <ToolbarButton
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title="Undo"
        icon={<Undo className="h-4 w-4" />}
      />
      <ToolbarButton
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title="Redo"
        icon={<Redo className="h-4 w-4" />}
      />
      <div className="mx-1 h-6 w-px bg-gray-300" />
      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold"
        icon={<Bold className="h-4 w-4" />}
        isActive={isBold}
      />
      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic"
        icon={<Italic className="h-4 w-4" />}
        isActive={isItalic}
      />
      <ToolbarButton
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline"
        icon={<Underline className="h-4 w-4" />}
        isActive={isUnderline}
      />
      <div className="mx-1 h-6 w-px bg-gray-300" />
      <select
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        onChange={e => {
          const value = e.target.value
          if (value === 'paragraph') formatParagraph()
          else if (value === 'h1') formatHeading('h1')
          else if (value === 'h2') formatHeading('h2')
          else if (value === 'h3') formatHeading('h3')
        }}
      >
        <option value="paragraph">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <ToolbarButton onClick={formatQuote} title="Quote" icon={<Quote className="h-4 w-4" />} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  title,
  icon,
  isActive,
}: {
  onClick: () => void
  title: string
  icon: React.ReactNode
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded p-1.5 hover:bg-gray-200',
        isActive && 'bg-gray-300 text-primary-600'
      )}
    >
      {icon}
    </button>
  )
}

