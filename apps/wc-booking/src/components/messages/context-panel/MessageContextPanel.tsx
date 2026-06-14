'use client'

import { Button, Link, Skeleton } from '@heroui/react'
import { X } from 'lucide-react'
import { statusLabel } from '@world-schools/wc-frontend-utils'
import { useMessagingStore } from '@/stores/messaging-store'
import { useMessagePanelStore } from '@/stores/message-panel-store'
import {
  type CampCardData,
  type ConversationContext,
  type PanelBookingState,
  useConversationContext,
} from '@/hooks/use-conversation-context'
import type { ParentBookingGroupDetail } from '@/types/camp-booking'
import {
  BookingSummarySection,
  CampInfoCard,
  CheckinSection,
  ChildrenSection,
  FormsSection,
  InquirySessionsSection,
  PaymentSection,
  RefundSection,
  ReviewPromptSection,
  StatusBanner,
  type StatusBannerVariant,
} from './panel-sections'

const PANEL_WIDTH = 'w-[380px]'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysUntil(iso: string): number | null {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  const ms = target.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function startsInLabel(iso: string): string | undefined {
  const days = daysUntil(iso)
  if (days == null) return undefined
  if (days > 1) return `Starts in ${days} days`
  if (days === 1) return 'Starts tomorrow'
  if (days === 0) return 'Starts today'
  return undefined
}

function atCampDayLabel(detail: ParentBookingGroupDetail): string | undefined {
  const start = new Date(detail.session.startDate)
  const end = new Date(detail.session.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const dayN = Math.min(
    totalDays,
    Math.max(1, Math.round((Date.now() - start.getTime()) / 86_400_000) + 1)
  )
  return `Day ${dayN} of ${totalDays}`
}

// ─── Per-state config ─────────────────────────────────────────────────────────

function headerTitle(context: ConversationContext): string {
  if (context.kind === 'inquiry') return 'Camp info'
  if (context.kind === 'booking') {
    if (context.state === 'past') return 'Past booking'
    if (context.state === 'cancelled') return 'Cancelled booking'
    return 'Your booking'
  }
  return 'Details'
}

function bookingBanner(
  state: PanelBookingState,
  detail: ParentBookingGroupDetail
): { variant: StatusBannerVariant; title: string; subtitle?: string } {
  switch (state) {
    case 'request-pending':
      return {
        variant: 'pending',
        title: 'Booking request sent',
        subtitle: 'Waiting for the camp to respond',
      }
    case 'confirmed':
      return {
        variant: 'success',
        title: 'Booking confirmed',
        subtitle: startsInLabel(detail.session.startDate),
      }
    case 'confirmed-paid':
      return {
        variant: 'success',
        title: 'Fully paid ✓',
        subtitle: startsInLabel(detail.session.startDate),
      }
    case 'at-camp':
      return { variant: 'info', title: '🏕️ At camp now', subtitle: atCampDayLabel(detail) }
    case 'past':
      return {
        variant: 'neutral',
        title: 'Completed',
        subtitle: formatDate(detail.session.endDate),
      }
    case 'cancelled':
      return {
        variant: 'danger',
        title: statusLabel(detail.status),
        subtitle: formatDate(detail.respondedAt ?? detail.updatedAt),
      }
  }
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button as={Link} href={href} fullWidth size="md" radius="sm" color="primary">
      {children}
    </Button>
  )
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button
      as={Link}
      href={href}
      fullWidth
      size="md"
      radius="sm"
      variant="bordered"
      color="secondary"
    >
      {children}
    </Button>
  )
}

function TextLink({
  href,
  children,
  danger = false,
}: {
  href: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <Button
      as={Link}
      href={href}
      variant="light"
      fullWidth
      size="md"
      color={danger ? 'danger' : 'default'}
      className="underline"
    >
      {children}
    </Button>
  )
}

function BookingActions({
  state,
  detail,
}: {
  state: PanelBookingState
  detail: ParentBookingGroupDetail
}) {
  const bookingHref = `/bookings/${detail.id}`
  const campHref = `/camp/${detail.camp.slug}`
  switch (state) {
    case 'request-pending':
      return (
        <>
          <SecondaryLink href={bookingHref}>View booking</SecondaryLink>
          <TextLink href={campHref}>View camp profile</TextLink>
          <TextLink href={bookingHref} danger>
            Cancel request
          </TextLink>
        </>
      )
    case 'confirmed':
    case 'confirmed-paid':
    case 'at-camp':
      return (
        <>
          <PrimaryLink href={bookingHref}>View full booking</PrimaryLink>
          <TextLink href={campHref}>View camp profile</TextLink>
        </>
      )
    case 'past':
      return (
        <>
          <SecondaryLink href={bookingHref}>View past booking</SecondaryLink>
          <TextLink href={campHref}>Book again</TextLink>
        </>
      )
    case 'cancelled':
      return (
        <>
          <PrimaryLink href={campHref}>Book again</PrimaryLink>
          <TextLink href={bookingHref}>View booking</TextLink>
        </>
      )
  }
}

// ─── Body per state ───────────────────────────────────────────────────────────

function BookingBody({
  state,
  detail,
  card,
}: {
  state: PanelBookingState
  detail: ParentBookingGroupDetail
  card: CampCardData
}) {
  const banner = bookingBanner(state, detail)
  return (
    <>
      <CampInfoCard
        photoUrl={card.photoUrl}
        name={card.name}
        location={card.locationLabel}
        appRating={card.appRating}
        appReviewCount={card.appReviewCount}
        googleRating={card.googleRating}
        googleReviewCount={card.googleReviewCount}
        googleReviewsUrl={card.googleReviewsUrl}
        compact
      />
      <StatusBanner variant={banner.variant} title={banner.title} subtitle={banner.subtitle} />

      {state === 'request-pending' ? (
        <BookingSummarySection detail={detail} title="Your request" />
      ) : null}

      {state === 'confirmed' ? (
        <>
          <BookingSummarySection detail={detail} />
          <ChildrenSection detail={detail} />
          <PaymentSection detail={detail} />
          <FormsSection />
        </>
      ) : null}

      {state === 'confirmed-paid' ? (
        <>
          <BookingSummarySection detail={detail} />
          <FormsSection />
          <CheckinSection detail={detail} />
        </>
      ) : null}

      {state === 'at-camp' ? (
        <>
          <ChildrenSection detail={detail} title="Children at camp" />
          <CheckinSection detail={detail} />
          <BookingSummarySection detail={detail} title="Booking summary" />
        </>
      ) : null}

      {state === 'past' ? (
        <>
          <ReviewPromptSection />
          <BookingSummarySection detail={detail} title="Booking summary" />
        </>
      ) : null}

      {state === 'cancelled' ? (
        <>
          <BookingSummarySection detail={detail} title="Cancellation details" />
          {detail.paidAmount > 0 ? <RefundSection detail={detail} /> : null}
        </>
      ) : null}
    </>
  )
}

function PanelBody({ context }: { context: ConversationContext }) {
  if (context.kind === 'loading') {
    return (
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-6 w-2/3 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (context.kind === 'inquiry') {
    const { data } = context
    return (
      <>
        <div className="flex-1 overflow-y-auto">
          <CampInfoCard
            photoUrl={data.card.photoUrl}
            name={data.card.name}
            location={data.card.locationLabel}
            appRating={data.card.appRating}
            appReviewCount={data.card.appReviewCount}
            googleRating={data.card.googleRating}
            googleReviewCount={data.card.googleReviewCount}
            googleReviewsUrl={data.card.googleReviewsUrl}
            responseTimeMinutes={data.avgResponseTimeMinutes}
          />
          <InquirySessionsSection
            sessions={data.sessions}
            currency={data.currency}
            campSlug={data.slug}
          />
        </div>
        {data.slug ? (
          <div className="flex flex-col gap-2.5 border-t border-default-200 p-6 dark:border-slate-700">
            <PrimaryLink href={`/book/${data.slug}`}>Start booking</PrimaryLink>
            <TextLink href={`/camp/${data.slug}`}>View full camp profile →</TextLink>
          </div>
        ) : null}
      </>
    )
  }

  if (context.kind === 'booking') {
    return (
      <>
        <div className="flex-1 overflow-y-auto">
          <BookingBody state={context.state} detail={context.detail} card={context.card} />
        </div>
        <div className="flex flex-col gap-2.5 border-t border-default-200 p-6 dark:border-slate-700">
          <BookingActions state={context.state} detail={context.detail} />
        </div>
      </>
    )
  }

  return null
}

// ─── Panel container ──────────────────────────────────────────────────────────

export function MessageContextPanel({ overlay = false }: { overlay?: boolean }) {
  const { activeConversationId, conversations } = useMessagingStore()
  const { isPanelOpen, setPanelOpen } = useMessagePanelStore()

  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null
  const context = useConversationContext(activeConversation)

  // Nothing to show for non-camp conversations (e.g. support) or no selection.
  if (!activeConversation || context.kind === 'none') return null

  const inner = (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <header className="flex items-center gap-3 border-b border-default-200 px-6 h-20 dark:border-slate-700">
        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="light"
          aria-label="Close panel"
          onPress={() => setPanelOpen(false)}
          className="text-secondary"
        >
          <X size={20} />
        </Button>
        <span className="text-base font-semibold text-secondary">{headerTitle(context)}</span>
      </header>
      <PanelBody context={context} />
    </div>
  )

  // Overlay mode: the chat area is too narrow to fit chat + panel side by side,
  // so the open panel covers the whole chat region (WhatsApp Web behaviour).
  if (overlay) {
    return (
      <aside
        className={`absolute inset-0 z-30 transition-transform duration-300 ease-in-out ${
          isPanelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
        aria-hidden={!isPanelOpen}
      >
        {inner}
      </aside>
    )
  }

  // Inline mode: collapsible right column that the chat narrows beside.
  return (
    <aside
      className={`shrink-0 overflow-hidden border-l border-default-200 transition-all duration-300 ease-in-out dark:border-slate-700 ${
        isPanelOpen ? `${PANEL_WIDTH} opacity-100` : 'w-0 opacity-0'
      }`}
    >
      <div className={PANEL_WIDTH + ' h-full'}>{inner}</div>
    </aside>
  )
}
