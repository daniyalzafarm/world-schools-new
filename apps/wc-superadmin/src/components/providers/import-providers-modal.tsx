'use client'

import { useState } from 'react'
import {
  addToast,
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { CheckCircle2, Download, Upload } from 'lucide-react'
import { DocumentDropzone } from '@world-schools/ui-web'
import { PROVIDER_IMPORT_COLUMNS } from '@world-schools/wc-types'
import { type ImportRowError, providersService } from '@/services/providers.services'

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

type Phase = 'select' | 'uploading' | 'results'

interface ImportResult {
  imported: number
  failed: number
  errors: ImportRowError[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportProvidersModal({ isOpen, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showColumns, setShowColumns] = useState(false)

  const reset = () => {
    setPhase('select')
    setSelectedFile(null)
    setFileError(null)
    setResult(null)
    setShowColumns(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFileSelect = (file: File) => {
    setFileError(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Only .csv files are accepted')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File size exceeds ${MAX_FILE_SIZE_MB} MB limit`)
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  const handleImport = async () => {
    if (!selectedFile) return
    setPhase('uploading')
    try {
      const data = await providersService.importProviders(selectedFile)
      setResult(data)
      setPhase('results')
      if (data.imported > 0) {
        onSuccess()
      }
    } catch (err: any) {
      setPhase('select')
      addToast({
        title: 'Import failed',
        description: err?.response?.data?.message ?? err?.message ?? 'Please try again.',
        color: 'danger',
      })
    }
  }

  const downloadTemplate = () => {
    // Column-oriented format: each row is "fieldKey,exampleValue"
    const lines = PROVIDER_IMPORT_COLUMNS.map(c => {
      const val = c.example
      const escaped = val.includes(',') ? `"${val}"` : val
      return `${c.key},${escaped}`
    })
    const csv = lines.join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'provider-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const requiredColumns = PROVIDER_IMPORT_COLUMNS.filter(c => c.required)
  const optionalColumns = PROVIDER_IMPORT_COLUMNS.filter(c => !c.required)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      scrollBehavior="inside"
      isDismissable={phase !== 'uploading'}
      hideCloseButton={phase === 'uploading'}
      classNames={{
        base: 'rounded-3xl',
        header: 'border-b border-divider',
        footer: 'border-t border-divider',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Import Providers</h2>
          <p className="text-sm font-normal text-default-500">
            {phase === 'results'
              ? 'Import complete'
              : 'Upload a CSV file to create multiple provider accounts at once'}
          </p>
        </ModalHeader>

        <ModalBody className="gap-5 py-6">
          {/* ── Phase: select ── */}
          {phase === 'select' && (
            <>
              {/* Download template */}
              <div className="flex items-center justify-between rounded-2xl border border-default-200 bg-default-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Download CSV Template</p>
                  <p className="text-xs text-default-500">
                    Start with the pre-filled template to ensure correct column names
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Download className="h-4 w-4" />}
                  onPress={downloadTemplate}
                >
                  Template
                </Button>
              </div>

              {/* File drop zone */}
              <DocumentDropzone
                accept=".csv,text/csv"
                title={
                  selectedFile
                    ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                    : 'Drag & drop CSV here or click to browse'
                }
                description={
                  selectedFile
                    ? 'Click to replace file'
                    : `.csv only · max ${MAX_FILE_SIZE_MB} MB · max 500 providers`
                }
                maxSize={MAX_FILE_SIZE_MB}
                onFileSelect={handleFileSelect}
              />

              {fileError && <p className="text-sm text-danger">{fileError}</p>}

              {/* Column reference toggle */}
              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setShowColumns(prev => !prev)}
                >
                  {showColumns ? 'Hide column reference' : 'View column reference'}
                </button>

                {showColumns && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-default-200">
                    <Table
                      aria-label="CSV column reference"
                      classNames={{ wrapper: 'shadow-none rounded-none max-h-72 overflow-auto' }}
                      removeWrapper={false}
                    >
                      <TableHeader>
                        <TableColumn>COLUMN</TableColumn>
                        <TableColumn>REQUIRED</TableColumn>
                        <TableColumn>DESCRIPTION</TableColumn>
                        <TableColumn>EXAMPLE</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {[...requiredColumns, ...optionalColumns].map(col => (
                          <TableRow key={col.key}>
                            <TableCell>
                              <code className="rounded bg-default-100 px-1.5 py-0.5 text-xs">
                                {col.key}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={col.required ? 'danger' : 'default'}
                              >
                                {col.required ? 'Required' : 'Optional'}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-default-600">{col.description}</span>
                              {col.options && (
                                <p className="mt-0.5 text-xs text-default-400">
                                  Options: {col.options.join(' | ')}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs text-default-500">{col.example}</code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Phase: uploading ── */}
          {phase === 'uploading' && (
            <DocumentDropzone
              accept=".csv,text/csv"
              icon="📊"
              title="Importing providers…"
              description="This may take a moment depending on file size."
              isUploading
              isDisabled
            />
          )}

          {/* ── Phase: results ── */}
          {phase === 'results' && result && (
            <>
              {/* Summary */}
              <div
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                  result.failed === 0
                    ? 'border-success-200 bg-success-50'
                    : result.imported === 0
                      ? 'border-danger-200 bg-danger-50'
                      : 'border-warning-200 bg-warning-50'
                }`}
              >
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    result.failed === 0
                      ? 'text-success'
                      : result.imported === 0
                        ? 'text-danger'
                        : 'text-warning'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold">
                    {result.imported > 0
                      ? `${result.imported} provider${result.imported !== 1 ? 's' : ''} imported successfully`
                      : 'No providers were imported'}
                  </p>
                  {result.failed > 0 && (
                    <p className="text-sm text-default-600">
                      {result.failed} provider{result.failed !== 1 ? 's' : ''} failed — see details
                      below
                    </p>
                  )}
                </div>
              </div>

              {/* Error table */}
              {result.errors.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-default-200">
                  <Table
                    aria-label="Import errors"
                    classNames={{ wrapper: 'shadow-none rounded-none max-h-64 overflow-auto' }}
                    removeWrapper={false}
                  >
                    <TableHeader>
                      <TableColumn>COLUMN</TableColumn>
                      <TableColumn>EMAIL</TableColumn>
                      <TableColumn>REASON</TableColumn>
                    </TableHeader>
                    <TableBody items={result.errors}>
                      {err => (
                        <TableRow key={`${err.column}-${err.email}`}>
                          <TableCell>
                            <span className="text-sm text-default-500">#{err.column}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{err.email || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-danger">{err.reason}</span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </ModalBody>

        <ModalFooter>
          {phase === 'select' && (
            <>
              <Button variant="flat" onPress={handleClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                startContent={<Upload className="h-4 w-4" />}
                isDisabled={!selectedFile}
                onPress={() => void handleImport()}
              >
                Import Providers
              </Button>
            </>
          )}
          {phase === 'uploading' && (
            <Button variant="flat" isDisabled>
              Importing…
            </Button>
          )}
          {phase === 'results' && (
            <>
              <Button variant="flat" onPress={reset}>
                Import Another
              </Button>
              <Button color="primary" onPress={handleClose}>
                Close
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
