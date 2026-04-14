import React from 'react'
import { Button } from '@heroui/react'
import { CheckCircle, Clock, Trash2 } from 'lucide-react'
import { DocumentDropzone, Input, SelectField, Textarea } from '@world-schools/ui-web'
import type { SupportTicketCategory } from '@world-schools/wc-types'

export interface NewSupportTicketFormContentProps {
  /** Currently selected category key (from the hook). */
  categoryKey: string
  /** Called when a category is selected, passes the key. */
  onCategoryChange: (key: string) => void
  subject: string
  onSubjectChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  attachments: File[]
  onAttachmentsChange: (files: File[]) => void
  submitting: boolean
  error: string | null
  successTicketNumber: string | null
  onSubmit: (e: React.FormEvent) => Promise<void>
  onCancel: () => void
  /** Available categories (fetched from API). */
  categories: SupportTicketCategory[]
  categoriesLoading?: boolean
  /** Accent colour class for the buttons (e.g. 'bg-slate-800' or 'bg-secondary'). */
  accentColorClass: string
  /** Subtitle text below the "Contact Support" heading. */
  helpSubtitle: string
  /** Label for the back-to-tickets button on success screen. */
  backHref?: string
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed'))
    return '📦'
  return '📄'
}

const ACCEPTED_FILE_TYPES =
  'image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,audio/*,video/*'

export function NewSupportTicketFormContent({
  categoryKey,
  onCategoryChange,
  subject,
  onSubjectChange,
  description,
  onDescriptionChange,
  attachments,
  onAttachmentsChange,
  submitting,
  error,
  successTicketNumber,
  onSubmit,
  onCancel,
  categories,
  categoriesLoading = false,
  accentColorClass,
  helpSubtitle,
}: NewSupportTicketFormContentProps) {
  const categoryOptions = categories.map(c => c.name)
  const selectedCategoryName = categories.find(c => c.key === categoryKey)?.name ?? ''

  const handleCategorySelect = (name: string) => {
    const cat = categories.find(c => c.name === name)
    if (cat) onCategoryChange(cat.key)
  }

  // Success state
  if (successTicketNumber) {
    return (
      <div className="flex flex-col gap-6 mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
            Contact Support
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400">{helpSubtitle}</p>
        </div>
        <div className="flex flex-col items-center gap-5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-12 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Request submitted</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We've received your message and will get back to you as soon as possible.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Reference: <strong className="font-mono">{successTicketNumber}</strong>
            </p>
          </div>
          <Button color="primary" className={`${accentColorClass} text-white`} onPress={onCancel}>
            Back to my tickets
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
          Contact Support
        </h1>
        <p className="text-base text-slate-500 dark:text-slate-400">{helpSubtitle}</p>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <Clock className="w-5 h-5 text-slate-500 shrink-0" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          We typically respond within 24 hours
        </span>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6 mb-12">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <SelectField
          label="Topic"
          placeholder={categoriesLoading ? 'Loading topics…' : 'Select a topic...'}
          options={categoryOptions}
          value={selectedCategoryName}
          onChange={handleCategorySelect}
          isRequired
          isDisabled={categoriesLoading}
        />

        <Input
          label="Subject"
          placeholder="Brief summary of your request"
          value={subject}
          onValueChange={onSubjectChange}
          isRequired
          maxLength={255}
          classNames={{ input: 'min-h-12' }}
        />

        <div className="flex flex-col gap-2">
          <Textarea
            label="Message"
            placeholder="Describe your issue or question in as much detail as you can..."
            value={description}
            onValueChange={onDescriptionChange}
            isRequired
            minRows={6}
            classNames={{ input: 'min-h-40' }}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Include IDs, error messages, or steps you've already tried.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Attachments <span className="font-normal text-slate-400">(optional)</span>
            </label>
          </div>
          <DocumentDropzone
            multiple
            onFilesSelect={files => onAttachmentsChange(files)}
            accept={ACCEPTED_FILE_TYPES}
            icon="📎"
            title="Click to upload or drag and drop"
            description="Images, documents and other supported files — up to 10MB each"
          />
          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {attachments.map((file, index) => {
                const icon = getFileIcon(file.type || '')
                const sizeKb = Math.round(file.size / 1024)
                return (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 truncate group"
                  >
                    <span className="shrink-0">{icon}</span>
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {sizeKb} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => onAttachmentsChange(attachments.filter((_, i) => i !== index))}
                      className="cursor-pointer ml-1 shrink-0"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            color="secondary"
            isLoading={submitting}
            isDisabled={submitting || !categoryKey || !subject.trim() || !description.trim()}
          >
            Submit request
          </Button>
          <Button type="button" variant="flat" onPress={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
