'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
  type ChipProps,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from '@heroui/react'
import { AlertTriangle, ArrowLeft, FileText, Gavel, Upload } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { PageSlot } from '@/components/layout/page-slot'
import { Can } from '@/components/auth/can'
import {
  type DisputeOutcome,
  type DisputeRow,
  disputesService,
  type EvidenceFileField,
  type EvidenceTextField,
  type SubmitEvidenceTextFields,
} from '@/services/disputes.services'

const OUTCOME_COLOR: Record<DisputeOutcome, ChipProps['color']> = {
  open: 'warning',
  won: 'success',
  lost: 'danger',
  warning_closed: 'default',
  other: 'default',
}

const OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  warning_closed: 'Warning closed',
  other: 'Other',
}

// Stripe's evidence schema differs by reason — these are the fields most
// likely to apply across the common reasons (`fraudulent`, `unrecognized`,
// `product_unacceptable`, `subscription_canceled`, `general`). The MVP shows
// all of them; richer per-reason rendering is a follow-up.
// Per-field maxLength matches the SubmitEvidenceDto on the backend so client-
// side capping prevents the user from hitting a 400 only after submitting.
const TEXT_FIELDS: Array<{
  key: EvidenceTextField
  label: string
  placeholder: string
  multiline: boolean
  maxLength: number
}> = [
  {
    key: 'customer_name',
    label: 'Customer name on the booking',
    placeholder: 'Ada Lovelace',
    multiline: false,
    maxLength: 500,
  },
  {
    key: 'customer_email_address',
    label: 'Customer email used at checkout',
    placeholder: 'ada@example.com',
    multiline: false,
    maxLength: 500,
  },
  {
    key: 'customer_purchase_ip',
    label: 'IP address at purchase',
    placeholder: '192.0.2.42',
    multiline: false,
    maxLength: 500,
  },
  {
    key: 'product_description',
    label: 'Product description',
    placeholder: 'Summer day camp, week of June 15…',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'customer_communication',
    label: 'Customer communication',
    placeholder: 'Booking confirmation emails, support transcripts…',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'shipping_address',
    label: 'Shipping address (if applicable)',
    placeholder: '',
    multiline: false,
    maxLength: 1_000,
  },
  {
    key: 'service_date',
    label: 'Service date(s)',
    placeholder: 'June 15–19, 2026',
    multiline: false,
    maxLength: 100,
  },
  {
    key: 'refund_policy',
    label: 'Refund policy text',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'refund_policy_disclosure',
    label: 'How was the refund policy disclosed?',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'cancellation_policy',
    label: 'Cancellation policy text',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'cancellation_policy_disclosure',
    label: 'How was the cancellation policy disclosed?',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'access_activity_log',
    label: 'Access / activity log',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
  {
    key: 'uncategorized_text',
    label: 'Other notes (uncategorized)',
    placeholder: '',
    multiline: true,
    maxLength: 20_000,
  },
]

const FILE_FIELDS: Array<{ key: EvidenceFileField; label: string; hint: string }> = [
  {
    key: 'service_documentation',
    label: 'Service documentation',
    hint: 'Booking confirmation, signed waiver, attendance log, etc.',
  },
  {
    key: 'shipping_documentation',
    label: 'Shipping documentation',
    hint: 'Receipt, signed delivery, etc. (rarely applies to camps)',
  },
]

// Stripe's evidence schema is reason-specific. Mapping derived from Stripe's
// dispute evidence guide — only the fields they actually consider for each
// reason are surfaced. Universal fields (`customer_name`,
// `customer_email_address`, `uncategorized_text`, `uncategorized_file`) are
// always shown. Reasons not in the map (or `unknown`) fall back to showing
// every field.
const UNIVERSAL_TEXT: ReadonlyArray<EvidenceTextField> = [
  'customer_name',
  'customer_email_address',
  'uncategorized_text',
]
const UNIVERSAL_FILE: ReadonlyArray<EvidenceFileField> = []

const EVIDENCE_FIELDS_BY_REASON: Record<
  string,
  { text: ReadonlyArray<EvidenceTextField>; file: ReadonlyArray<EvidenceFileField> }
> = {
  unrecognized: {
    text: ['customer_communication', 'product_description', 'service_date', 'customer_purchase_ip'],
    file: ['service_documentation'],
  },
  fraudulent: {
    text: [
      'customer_communication',
      'customer_purchase_ip',
      'access_activity_log',
      'product_description',
      'service_date',
    ],
    file: ['service_documentation'],
  },
  product_unacceptable: {
    text: ['product_description', 'service_date', 'refund_policy', 'refund_policy_disclosure'],
    file: ['service_documentation'],
  },
  product_not_received: {
    text: ['product_description', 'service_date', 'shipping_address'],
    file: ['service_documentation', 'shipping_documentation'],
  },
  duplicate: {
    text: ['customer_communication', 'product_description'],
    file: ['service_documentation'],
  },
  subscription_canceled: {
    text: ['cancellation_policy', 'cancellation_policy_disclosure', 'customer_communication'],
    file: ['service_documentation'],
  },
  credit_not_processed: {
    text: ['refund_policy', 'refund_policy_disclosure', 'customer_communication'],
    file: ['service_documentation'],
  },
  general: {
    text: ['product_description', 'customer_communication', 'service_date', 'refund_policy'],
    file: ['service_documentation'],
  },
}

export default function DisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<DisputeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textValues, setTextValues] = useState<SubmitEvidenceTextFields>({})
  const [files, setFiles] = useState<Partial<Record<EvidenceFileField, File>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await disputesService.getById(disputeId)
    if (!result.success) {
      setError((result.data as { message?: string })?.message ?? 'Failed to load dispute')
      setDispute(null)
    } else {
      setDispute(result.data)
    }
    setLoading(false)
  }, [disputeId])

  useEffect(() => {
    void load()
  }, [load])

  const isOpen = dispute?.outcome === 'open'

  // Filter the evidence fields shown in the form to those relevant for the
  // dispute's `reason` (per Stripe's schema). Reasons we don't have a mapping
  // for fall through to showing all fields, so we never hide a field the
  // issuing bank might actually accept.
  const { visibleTextFields, visibleFileFields } = useMemo(() => {
    const reason = dispute?.reason
    const mapping = reason ? EVIDENCE_FIELDS_BY_REASON[reason] : undefined
    if (!mapping) {
      return { visibleTextFields: TEXT_FIELDS, visibleFileFields: FILE_FIELDS }
    }
    const allowedText = new Set<EvidenceTextField>([...UNIVERSAL_TEXT, ...mapping.text])
    const allowedFile = new Set<EvidenceFileField>([...UNIVERSAL_FILE, ...mapping.file])
    return {
      visibleTextFields: TEXT_FIELDS.filter(f => allowedText.has(f.key)),
      visibleFileFields: FILE_FIELDS.filter(f => allowedFile.has(f.key)),
    }
  }, [dispute?.reason])

  const handleSave = useCallback(
    async (submit: boolean) => {
      if (!dispute) return
      setSubmitting(true)
      try {
        const fileEntries = Object.entries(files).filter(([, f]) => !!f) as Array<
          [EvidenceFileField, File]
        >
        const result = await disputesService.submitEvidence(dispute.id, {
          submit,
          text: textValues,
          files: fileEntries.map(([field, file]) => ({ field, file })),
        })
        if (!result.success) {
          const message =
            (result.data as { message?: string })?.message ?? 'Failed to submit evidence'
          addToast({ title: 'Error', description: message, color: 'danger' })
          return
        }
        addToast({
          title: submit ? 'Submitted' : 'Saved',
          description: submit
            ? 'Evidence sent to Stripe. Status will refresh once Stripe responds.'
            : 'Draft saved on the dispute. You can submit later.',
          color: 'success',
        })
        setDispute(result.data as DisputeRow)
        // After a successful submit, clear the form so a re-open of the page
        // doesn't show stale evidence values that were already sent to Stripe.
        // Drafts retain the form so the operator can keep editing.
        if (submit) {
          setTextValues({})
          setFiles({})
        }
      } finally {
        // Always close the confirm modal — leaving it open with `submitting=true`
        // and Cancel disabled traps the user when the request fails.
        setConfirmSubmit(false)
        setSubmitting(false)
      }
    },
    [dispute, files, textValues]
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    )
  }
  if (error || !dispute) {
    return (
      <PageSlot>
        <Card className="border border-danger-200 bg-danger-50">
          <CardBody>
            <p className="text-danger">{error ?? 'Dispute not found.'}</p>
          </CardBody>
        </Card>
      </PageSlot>
    )
  }

  const evidenceDue = dispute.evidenceDueBy ? new Date(dispute.evidenceDueBy) : null

  return (
    <PageSlot>
      <Breadcrumb
        items={[{ label: 'Disputes', href: '/disputes' }, { label: dispute.stripeDisputeId }]}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary-50 p-2 text-primary">
            <Gavel className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Dispute</h1>
              <Chip color={OUTCOME_COLOR[dispute.outcome]} variant="flat" size="sm">
                {OUTCOME_LABEL[dispute.outcome]}
              </Chip>
              {dispute.fundsWithdrawnAt && !dispute.fundsReinstatedAt ? (
                <Chip color="danger" variant="flat" size="sm">
                  Funds withdrawn
                </Chip>
              ) : null}
              {dispute.fundsReinstatedAt ? (
                <Chip color="success" variant="flat" size="sm">
                  Funds reinstated
                </Chip>
              ) : null}
            </div>
            <p className="text-sm text-default-500">
              Stripe ID <span className="font-mono">{dispute.stripeDisputeId}</span> ·{' '}
              {dispute.amount} {dispute.currency.toUpperCase()} · reason{' '}
              <span className="capitalize">{dispute.reason.replace(/_/g, ' ')}</span>
            </p>
          </div>
        </div>
        <Button
          variant="light"
          startContent={<ArrowLeft className="h-4 w-4" />}
          onPress={() => router.push('/disputes')}
        >
          Back to list
        </Button>
      </div>

      {evidenceDue && isOpen ? <DeadlineBanner due={evidenceDue} /> : null}

      <Card shadow="sm" className="border border-default-200">
        <CardBody className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Booking</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Booking number">
              {dispute.bookingGroup?.bookingGroupNumber ?? dispute.bookingGroupId}
            </Field>
            <Field label="Booking status">
              <span className="capitalize">
                {(dispute.bookingGroup?.status ?? '').replace(/_/g, ' ')}
              </span>
            </Field>
            <Field label="Camp">{dispute.bookingGroup?.camp?.name ?? '—'}</Field>
            <Field label="Provider">
              {dispute.bookingGroup?.provider?.legalCompanyName ?? '—'}
            </Field>
            <Field label="Parent">
              {[
                dispute.bookingGroup?.parent?.user?.firstName,
                dispute.bookingGroup?.parent?.user?.lastName,
              ]
                .filter(Boolean)
                .join(' ') || '—'}
              {dispute.bookingGroup?.parent?.user?.email ? (
                <span className="block text-xs text-default-500">
                  {dispute.bookingGroup.parent.user.email}
                </span>
              ) : null}
            </Field>
            <Field label="Stripe charge">
              <span className="font-mono text-xs">{dispute.payment?.stripeChargeId ?? '—'}</span>
            </Field>
          </dl>
        </CardBody>
      </Card>

      {isOpen ? (
        <Card shadow="sm" className="border border-default-200">
          <CardBody className="space-y-5 p-5">
            <div>
              <h2 className="text-lg font-semibold">Evidence</h2>
              <p className="text-sm text-default-500">
                All fields are optional. Stripe shows what you submit to the issuing bank along with
                the rest of the booking record. Submitted evidence cannot be edited later — save a
                draft first if you want to review the Stripe response before committing.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibleTextFields.map(field =>
                field.multiline ? (
                  <Textarea
                    key={field.key}
                    label={field.label}
                    labelPlacement="outside"
                    placeholder={field.placeholder}
                    value={textValues[field.key] ?? ''}
                    onValueChange={value =>
                      setTextValues(prev => ({ ...prev, [field.key]: value }))
                    }
                    minRows={3}
                    maxLength={field.maxLength}
                    isDisabled={submitting}
                    className={field.key === 'product_description' ? 'sm:col-span-2' : undefined}
                  />
                ) : (
                  <Input
                    key={field.key}
                    label={field.label}
                    labelPlacement="outside"
                    placeholder={field.placeholder}
                    type="text"
                    value={textValues[field.key] ?? ''}
                    onValueChange={value =>
                      setTextValues(prev => ({ ...prev, [field.key]: value }))
                    }
                    maxLength={field.maxLength}
                    isDisabled={submitting}
                  />
                )
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {visibleFileFields.map(field => {
                const inputId = `dispute-evidence-${field.key}`
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
                      {field.label}
                    </label>
                    <p className="text-xs text-default-500">{field.hint}</p>
                    <input
                      id={inputId}
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/gif,text/plain"
                      onChange={e =>
                        setFiles(prev => ({
                          ...prev,
                          [field.key]: e.target.files?.[0] ?? undefined,
                        }))
                      }
                      disabled={submitting}
                      className="block w-full text-sm text-default-700 file:mr-3 file:rounded-md file:border-0 file:bg-default-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                    />
                    {files[field.key] ? (
                      <p className="text-xs text-success">{files[field.key]?.name}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <Can permission="disputes.write">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="flat"
                  onPress={() => void handleSave(false)}
                  isLoading={submitting}
                  startContent={<FileText className="h-4 w-4" />}
                >
                  Save draft
                </Button>
                <Button
                  color="primary"
                  onPress={() => setConfirmSubmit(true)}
                  isLoading={submitting}
                  startContent={<Upload className="h-4 w-4" />}
                >
                  Submit to Stripe
                </Button>
                <div className="ml-auto">
                  <Button
                    variant="light"
                    color="warning"
                    onPress={() => setOverrideOpen(true)}
                    startContent={<AlertTriangle className="h-4 w-4" />}
                  >
                    Manual outcome override
                  </Button>
                </div>
              </div>
            </Can>
          </CardBody>
        </Card>
      ) : (
        <Card shadow="sm" className="border border-default-200">
          <CardBody className="p-5">
            <p className="text-sm text-default-600">
              This dispute is no longer open. Evidence submission is closed; the outcome above is
              the recorded result.
            </p>
          </CardBody>
        </Card>
      )}

      <ConfirmSubmitModal
        isOpen={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => void handleSave(true)}
        submitting={submitting}
      />

      <OverrideOutcomeModal
        isOpen={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        disputeId={dispute.id}
        currentOutcome={dispute.outcome}
        onSaved={() => {
          setOverrideOpen(false)
          void load()
        }}
      />
    </PageSlot>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-default-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

function DeadlineBanner({ due }: { due: Date }) {
  const hoursUntilDue = Math.floor((due.getTime() - Date.now()) / (60 * 60 * 1000))
  const isPastDue = hoursUntilDue < 0
  const isUrgent = !isPastDue && hoursUntilDue <= 72

  if (!isPastDue && !isUrgent) {
    return (
      <div className="rounded-lg border border-default-200 bg-default-50 px-4 py-3 text-sm">
        Evidence due by {due.toLocaleString('en-US')} ({hoursUntilDue}h remaining)
      </div>
    )
  }
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        isPastDue
          ? 'border-danger-200 bg-danger-50 text-danger-700'
          : 'border-warning-200 bg-warning-50 text-warning-700'
      }`}
    >
      <strong>
        {isPastDue ? 'Evidence deadline has passed.' : `${hoursUntilDue}h until evidence is due.`}
      </strong>{' '}
      {isPastDue
        ? 'Stripe may auto-close this in our favor (the cardholder withdrew) or against us — submit anyway in case it remains open.'
        : `Submit before ${due.toLocaleString('en-US')} or the chargeback is forfeited.`}
    </div>
  )
}

function ConfirmSubmitModal({
  isOpen,
  onClose,
  onConfirm,
  submitting,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  submitting: boolean
}) {
  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => undefined : onClose} size="md">
      <ModalContent>
        <ModalHeader>Submit evidence to Stripe?</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-700">
            Stripe sends the evidence to the issuing bank for review and the dispute moves to
            <em> under_review</em>. You won&apos;t be able to edit or resubmit after this.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button color="primary" onPress={onConfirm} isLoading={submitting}>
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function OverrideOutcomeModal({
  isOpen,
  onClose,
  disputeId,
  currentOutcome,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  disputeId: string
  currentOutcome: DisputeOutcome
  onSaved: () => void
}) {
  const [outcome, setOutcome] = useState<DisputeOutcome>(
    currentOutcome === 'open' ? 'lost' : currentOutcome
  )
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Re-sync state every time the modal re-opens, so a parent reload between
  // override attempts (e.g. admin opens, closes, reloads, reopens) doesn't
  // leave the dropdown stuck on a stale value.
  useEffect(() => {
    if (isOpen) {
      setOutcome(currentOutcome === 'open' ? 'lost' : currentOutcome)
      setNote('')
    }
  }, [isOpen, currentOutcome])

  const overrideOutcomes: Array<{ key: Exclude<DisputeOutcome, 'open'>; label: string }> = useMemo(
    () => [
      { key: 'won', label: 'Won' },
      { key: 'lost', label: 'Lost' },
      { key: 'warning_closed', label: 'Warning closed' },
      { key: 'other', label: 'Other' },
    ],
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await disputesService.overrideOutcome(disputeId, {
        outcome: outcome as Exclude<DisputeOutcome, 'open'>,
        note: note.trim() || undefined,
      })
      if (!result.success) {
        const message =
          (result.data as { message?: string })?.message ?? 'Failed to override outcome'
        addToast({ title: 'Error', description: message, color: 'danger' })
        return
      }
      addToast({
        title: 'Override recorded',
        description:
          'Outcome updated locally. Stripe is unaware of this change — only our DB classification was changed.',
        color: 'success',
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={saving ? () => undefined : onClose} size="md">
      <ModalContent>
        <ModalHeader>Manual outcome override</ModalHeader>
        <ModalBody className="space-y-3">
          <div className="rounded-md border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
            This does NOT call Stripe. Use only when Stripe&apos;s webhook is delayed or stuck and
            you need to close the dispute in our system for downstream reconciliation.
          </div>
          <Select
            label="New outcome"
            labelPlacement="outside"
            selectedKeys={new Set([outcome])}
            onSelectionChange={keys => {
              const value = Array.from(keys)[0]
              if (typeof value === 'string') setOutcome(value as DisputeOutcome)
            }}
            isDisabled={saving}
          >
            {overrideOutcomes.map(item => (
              <SelectItem key={item.key}>{item.label}</SelectItem>
            ))}
          </Select>
          <Textarea
            label="Reason / audit note"
            labelPlacement="outside"
            placeholder="Why is the manual override needed?"
            value={note}
            onValueChange={setNote}
            minRows={3}
            maxLength={2000}
            isDisabled={saving}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button color="warning" onPress={() => void handleSave()} isLoading={saving}>
            Override
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
