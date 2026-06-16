'use client'

import { useState } from 'react'
import { Button, Card, CardBody, Checkbox, Input, Textarea } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import {
  type ForceMajeureExecuteResult,
  forceMajeureService,
} from '@/services/force-majeure.services'

/**
 * Payments revamp (Spec v2.3 §8) — Force Majeure bulk tool.
 *
 * Select active bookings by programme date window (optionally one provider) and
 * cancel them all with a FM cash refund (captured funds back minus the platform
 * fee). `Preview` is a dry run; `Execute` performs the cancellations and records
 * a force-majeure event. Guarded behind `billing.write`.
 */

export default function ForceMajeurePage() {
  const [description, setDescription] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [providerId, setProviderId] = useState('')
  const [region, setRegion] = useState('')
  const [refundPlatformFee, setRefundPlatformFee] = useState(false)

  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [result, setResult] = useState<ForceMajeureExecuteResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scope = () => ({
    dateFrom: new Date(dateFrom).toISOString(),
    dateTo: new Date(dateTo).toISOString(),
    providerId: providerId.trim() || undefined,
    region: region.trim() || undefined,
  })

  const canSubmit = dateFrom !== '' && dateTo !== ''

  const handlePreview = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    const res = await forceMajeureService.preview(scope())
    setBusy(false)
    if (!res.success) {
      setError((res.data as { message?: string })?.message ?? 'Preview failed')
      setPreviewCount(null)
      return
    }
    setPreviewCount(res.data.affectedBookingCount)
  }

  const handleExecute = async () => {
    if (description.trim().length === 0) {
      setError('A description is required (recorded on the force-majeure event).')
      return
    }
    if (
      !window.confirm(
        `Cancel ${previewCount ?? 'all matching'} booking(s) with a Force Majeure refund? This cannot be undone.`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    const res = await forceMajeureService.execute({
      ...scope(),
      description: description.trim(),
      refundPlatformFee,
    })
    setBusy(false)
    if (!res.success) {
      setError((res.data as { message?: string })?.message ?? 'Execution failed')
      return
    }
    setResult(res.data)
    setPreviewCount(null)
  }

  return (
    <PageSlot>
      <section className="max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Force Majeure</h1>
          <p className="mt-1 text-default-600">
            Bulk-cancel active bookings in a programme date window with a cash refund (captured
            funds back minus the platform fee). Preview first, then execute.
          </p>
        </header>

        <Card>
          <CardBody className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                type="date"
                label="Programme start from"
                labelPlacement="outside"
                value={dateFrom}
                onValueChange={setDateFrom}
                isRequired
              />
              <Input
                type="date"
                label="Programme start to"
                labelPlacement="outside"
                value={dateTo}
                onValueChange={setDateTo}
                isRequired
              />
            </div>
            <Input
              label="Provider ID (optional)"
              labelPlacement="outside"
              placeholder="Limit to one provider"
              value={providerId}
              onValueChange={setProviderId}
            />
            <Input
              label="Region (optional, audit label)"
              labelPlacement="outside"
              placeholder="e.g. Southern France"
              value={region}
              onValueChange={setRegion}
            />
            <Textarea
              label="Description"
              labelPlacement="outside"
              placeholder="What happened — recorded on the force-majeure event."
              value={description}
              onValueChange={setDescription}
              minRows={2}
            />

            <Checkbox isSelected={refundPlatformFee} onValueChange={setRefundPlatformFee}>
              <span className="text-sm">
                Also refund the platform fee
                <span className="block text-default-500">
                  By default the platform fee is retained. Tick to reverse it on every refund too.
                </span>
              </span>
            </Checkbox>

            {error ? (
              <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {error}
              </div>
            ) : null}

            {previewCount != null ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
                <AlertTriangle className="h-4 w-4" />
                {previewCount} active booking(s) match this scope.
              </div>
            ) : null}

            {result ? (
              <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
                Force majeure event <span className="font-mono">{result.eventId}</span> applied —{' '}
                {result.cancelled} cancelled, {result.failed} skipped, total refunded{' '}
                {result.totalRefunded}.
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="flat" isDisabled={!canSubmit || busy} onPress={handlePreview}>
                Preview
              </Button>
              <Button
                color="danger"
                isDisabled={!canSubmit || busy}
                isLoading={busy}
                onPress={handleExecute}
              >
                Execute
              </Button>
            </div>
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
