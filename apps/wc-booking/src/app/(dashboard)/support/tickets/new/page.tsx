'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@heroui/react'
import { CheckCircle, Clock } from 'lucide-react'
import { Input, SelectField, Textarea } from '@world-schools/ui-web'
import { useAuthStore } from '@/stores/auth-store'
import { supportTicketsService } from '@/services/support-tickets.services'

/** Parent-facing category options (keys match backend SupportTicketCategory seeds). */
const TICKET_CATEGORIES = [
  { key: 'booking_issue', label: 'Booking Issues' },
  { key: 'payment_refund', label: 'Payment & Refunds' },
  { key: 'technical_issue', label: 'Technical Support' },
  { key: 'account_help', label: 'Account Help' },
  { key: 'camp_question', label: 'Question About a Camp' },
] as const

const CATEGORY_OPTIONS = TICKET_CATEGORIES.map(c => c.label)

export default function SupportNewTicketPage() {
  const { user } = useAuthStore()
  const [categoryLabel, setCategoryLabel] = useState<string>('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successTicketNumber, setSuccessTicketNumber] = useState<string | null>(null)

  const categoryKey = TICKET_CATEGORIES.find(c => c.label === categoryLabel)?.key ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      setError('You must be signed in to submit a ticket.')
      return
    }
    if (!categoryKey || !subject.trim() || !description.trim()) {
      setError('Please fill in category, subject, and description.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = await supportTicketsService.createTicket({
        requesterType: 'PARENT',
        requesterUserId: user.id,
        sourceApp: 'WC_BOOKING',
        categoryKey,
        subject: subject.trim(),
        description: description.trim(),
      })
      if (!result.success) {
        const msg =
          'data' in result &&
          result.data &&
          typeof result.data === 'object' &&
          'message' in result.data
            ? (result.data as { message: string }).message
            : 'Failed to create ticket'
        setError(msg)
        setSubmitting(false)
        return
      }
      setSuccessTicketNumber(result.data.ticketNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (successTicketNumber) {
    return (
      <div className="flex flex-col gap-6 mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mb-2">
            Contact Support
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400">
            Can't find what you're looking for? Send us a message and we'll help you out.
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-12 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Request submitted</h2>
            <p className="text-slate-600 dark:text-slate-400">
              We've received your message and will get back to you within 24 hours.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Reference: <strong className="font-mono">{successTicketNumber}</strong>
            </p>
          </div>
          <Button
            as={Link}
            href="/support/tickets"
            color="primary"
            className="bg-[#1E2A4A] text-white"
          >
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
        <p className="text-base text-slate-500 dark:text-slate-400">
          Can't find what you're looking for? Send us a message and we'll help you out.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <Clock className="w-5 h-5 text-slate-500 shrink-0" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          We typically respond within 24 hours
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 mb-12">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <SelectField
          label="Topic"
          placeholder="Select a topic..."
          options={CATEGORY_OPTIONS}
          value={categoryLabel}
          onChange={setCategoryLabel}
          isRequired
        />

        <Input
          label="Subject"
          placeholder="Brief summary of your request"
          value={subject}
          onValueChange={setSubject}
          isRequired
          maxLength={255}
          classNames={{ input: 'min-h-12' }}
        />

        <div className="flex flex-col gap-2">
          <Textarea
            label="Message"
            placeholder="Describe your issue or question in as much detail as you can..."
            value={description}
            onValueChange={setDescription}
            isRequired
            minRows={6}
            classNames={{ input: 'min-h-[160px]' }}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Include booking IDs, error messages, or steps you've already tried.
          </p>
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
          <Button as={Link} href="/support/tickets" variant="flat">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
