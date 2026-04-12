'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { CheckCircle2, Download, Upload } from 'lucide-react'
import { DocumentDropzone } from '@world-schools/ui-web'
import { SESSION_IMPORT_COLUMNS } from '@world-schools/wc-types'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageSlot } from '@/components/layout/page-slot'
import { useProvidersStore } from '@/stores/providers-store'
import { type ImportSessionRowError, providersService } from '@/services/providers.services'

const MAX_FILE_SIZE_MB = 5
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

type Phase = 'select' | 'uploading' | 'results'

interface ImportResult {
  imported: number
  failed: number
  errors: ImportSessionRowError[]
}

const getInitials = (name: string | null | undefined) => {
  if (!name) return '?'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export default function ImportSessionsPage() {
  const params = useParams()
  const router = useRouter()
  const providerId = params.id as string
  const campId = params.campId as string

  const { detail, fetchDetail } = useProvidersStore()

  const [phase, setPhase] = useState<Phase>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    if (!detail || (detail as any).id !== providerId) {
      void fetchDetail(providerId)
    }
  }, [providerId, detail, fetchDetail])

  const providerName = getInitials(detail?.legalCompanyName ?? detail?.businessName) || 'Provider'
  const camp = detail?.camps?.find((c: any) => c.id === campId)
  const campName = camp?.name ?? 'Camp'
  const providerHref = `/providers/${providerId}`
  const campHref = `${providerHref}?tab=camps`

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
      const data = await providersService.importSessions(providerId, campId, selectedFile)
      setResult(data)
      setPhase('results')
    } catch (err: any) {
      setPhase('select')
      addToast({
        title: 'Import failed',
        description: err?.response?.data?.message ?? err?.message ?? 'Please try again.',
        color: 'danger',
      })
    }
  }

  const handleImportAnother = () => {
    setPhase('select')
    setSelectedFile(null)
    setFileError(null)
    setResult(null)
  }

  const isDayCamp = camp?.type === 'day'

  const downloadTemplate = () => {
    // Two example sessions: session 1 = single pricing/availability,
    // session 2 = age_group pricing/availability. Day camps also include
    // sessionDayType / arrivalTime / departureTime columns.
    const escape = (v: string) => (v.includes(',') ? `"${v}"` : v)

    const session1: Record<string, string> = {
      name: 'Summer Week 1',
      startDate: '2026-07-07',
      endDate: '2026-07-11',
      pricingType: 'single',
      price: '1200',
      ageGroupPrices: '',
      availabilityType: 'single',
      totalSpots: '50',
      ageGroupSpots: '',
      ...(isDayCamp && { sessionDayType: 'full_day', arrivalTime: '', departureTime: '' }),
      status: 'draft',
    }

    const session2: Record<string, string> = {
      name: 'Summer Week 2',
      startDate: '2026-07-14',
      endDate: '2026-07-18',
      pricingType: 'age_group',
      price: '',
      ageGroupPrices: '8-12:1200,13-17:1500',
      availabilityType: 'age_group',
      totalSpots: '',
      ageGroupSpots: '8-12:50,13-17:30',
      ...(isDayCamp && {
        sessionDayType: 'half_day',
        arrivalTime: '09:00',
        departureTime: '13:00',
      }),
      status: 'draft',
    }

    const columns = SESSION_IMPORT_COLUMNS.filter(c => !c.dayOnly || isDayCamp)
    const lines = columns.map(c => {
      const v1 = session1[c.key] ?? ''
      const v2 = session2[c.key] ?? ''
      return `${c.key},${escape(v1)},${escape(v2)}`
    })

    const csv = lines.join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'session-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleColumns = SESSION_IMPORT_COLUMNS.filter(c => !c.dayOnly || isDayCamp)
  const requiredColumns = visibleColumns.filter(c => c.required)
  const optionalColumns = visibleColumns.filter(c => !c.required)

  return (
    <PageSlot>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'All Providers', href: '/providers' },
            { label: providerName, href: providerHref },
            { label: campName, href: campHref },
            { label: 'Import Sessions' },
          ]}
        />

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Sessions</h1>
          <p className="mt-1 text-sm text-default-500">
            {phase === 'results'
              ? 'Import complete — review the results below.'
              : `Upload a CSV to create multiple sessions. Max 50 sessions per camp.`}
          </p>
        </div>

        {/* ── Phase: select ── */}
        {phase === 'select' && (
          <div className="flex flex-col gap-6">
            {/* Step 1: template */}
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
              <CardBody className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">1. Download Template</p>
                    <p className="mt-0.5 text-xs text-default-500">
                      Start with the pre-filled template to ensure correct column layout and field
                      order.
                    </p>
                    <p className="mt-1.5 text-xs text-warning-400">
                      This template is tailored for{' '}
                      <span className="font-bold capitalize">{camp?.type ?? 'this'}</span> camps.{' '}
                      {isDayCamp
                        ? 'Day-camp fields (sessionDayType, arrivalTime, departureTime) are included.'
                        : 'Day-camp-only fields (sessionDayType, arrivalTime, departureTime) are excluded.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Download className="h-4 w-4" />}
                    onPress={downloadTemplate}
                    className="shrink-0"
                  >
                    Template
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Step 2: upload */}
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
              <CardBody className="space-y-4 p-5">
                <p className="text-sm font-semibold">2. Upload CSV File</p>
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
                      : `.csv only · max ${MAX_FILE_SIZE_MB} MB · max 50 sessions per camp`
                  }
                  maxSize={MAX_FILE_SIZE_MB}
                  onFileSelect={handleFileSelect}
                />
                {fileError && <p className="text-sm text-danger">{fileError}</p>}
                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    color="primary"
                    isDisabled={!selectedFile}
                    startContent={<Upload className="h-4 w-4" />}
                    onPress={() => void handleImport()}
                  >
                    Import Sessions
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Field reference */}
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
              <CardBody className="p-0">
                <div className="border-b border-default-200 px-6 py-4">
                  <h2 className="text-sm font-semibold">Field Reference</h2>
                  <p className="mt-0.5 text-xs text-default-500">
                    Each row in your CSV is one field. The first cell is the key; every additional
                    column is one session.
                  </p>
                </div>
                <div className="overflow-auto">
                  <Table
                    aria-label="CSV field reference"
                    classNames={{ wrapper: 'shadow-none rounded-none' }}
                    removeWrapper={false}
                  >
                    <TableHeader>
                      <TableColumn>FIELD</TableColumn>
                      <TableColumn>REQUIRED</TableColumn>
                      <TableColumn>DESCRIPTION</TableColumn>
                      <TableColumn>EXAMPLE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {[...requiredColumns, ...optionalColumns].map(col => (
                        <TableRow key={col.key}>
                          <TableCell>
                            <code className="rounded bg-default-100 px-1.5 py-0.5 font-mono text-xs">
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
                            <p className="text-xs text-default-600">{col.description}</p>
                            {col.options && (
                              <p className="mt-0.5 text-xs text-default-400">
                                Options: {col.options.join(' | ')}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="break-all text-xs text-default-500">
                              {col.example}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* ── Phase: uploading ── */}
        {phase === 'uploading' && (
          <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
            <CardBody className="p-10">
              <DocumentDropzone
                accept=".csv,text/csv"
                icon="🗓️"
                title="Importing sessions…"
                description="This may take a moment depending on file size."
                isUploading
                isDisabled
              />
            </CardBody>
          </Card>
        )}

        {/* ── Phase: results ── */}
        {phase === 'results' && result && (
          <div className="space-y-4">
            {/* Summary card */}
            <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
              <CardBody className="space-y-5 p-6">
                {/* Banner */}
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
                        ? `${result.imported} session${result.imported !== 1 ? 's' : ''} imported successfully`
                        : 'No sessions were imported'}
                    </p>
                    {result.failed > 0 && (
                      <p className="mt-0.5 text-sm text-default-600">
                        {result.failed} session{result.failed !== 1 ? 's' : ''} failed — see the
                        error details below.
                      </p>
                    )}
                  </div>
                </div>

                {/* Result actions */}
                <div className="flex gap-3">
                  <Button variant="flat" onPress={handleImportAnother}>
                    Import Another File
                  </Button>
                  <Button color="primary" onPress={() => router.push(providerHref)}>
                    Back to Provider
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Error table */}
            {result.errors.length > 0 && (
              <Card
                className="rounded-3xl border border-slate-200 dark:border-slate-800"
                shadow="sm"
              >
                <CardBody className="p-0">
                  <div className="border-b border-default-200 px-6 py-4">
                    <h2 className="text-sm font-semibold text-danger">
                      Failed Rows ({result.errors.length})
                    </h2>
                    <p className="mt-0.5 text-xs text-default-500">
                      Fix the issues below and re-upload a CSV with only the failed rows.
                    </p>
                  </div>
                  <Table
                    aria-label="Import errors"
                    classNames={{ wrapper: 'shadow-none rounded-none' }}
                    removeWrapper={false}
                  >
                    <TableHeader>
                      <TableColumn>COLUMN</TableColumn>
                      <TableColumn>SESSION NAME</TableColumn>
                      <TableColumn>REASON</TableColumn>
                    </TableHeader>
                    <TableBody items={result.errors}>
                      {err => (
                        <TableRow key={`${err.column}-${err.name}`}>
                          <TableCell>
                            <span className="font-mono text-sm text-default-500">
                              #{err.column}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{err.name || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-danger">{err.reason}</span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageSlot>
  )
}
