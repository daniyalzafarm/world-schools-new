import type { Prisma } from '../../generated/client/client'

const ZURICH_TZ = 'Europe/Zurich'

/**
 * Same wall-clock interpretation as {@link SupportTicketSlaService#toZurichDate}:
 * convert a UTC instant to a Date whose UTC fields match Zurich local components.
 */
export function toZurichWallDate(date: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = fmt.formatToParts(date).reduce(
    (acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = parseInt(part.value, 10)
      }
      return acc
    },
    {} as Record<string, number>
  )

  const year = parts.year
  const month = parts.month
  const day = parts.day
  const hour = parts.hour ?? 0
  const minute = parts.minute ?? 0
  const second = parts.second ?? 0

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

/**
 * Next WC-YYYYMMDD-NNNN for booking groups (daily sequence in Zurich, same idea as support tickets).
 */
export async function generateBookingGroupNumber(
  tx: Prisma.TransactionClient,
  createdAt: Date
): Promise<string> {
  const tzDate = toZurichWallDate(createdAt)
  const yyyy = tzDate.getUTCFullYear()
  const mm = String(tzDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(tzDate.getUTCDate()).padStart(2, '0')
  const prefix = `WC-${yyyy}${mm}${dd}-`

  const startOfDay = new Date(Date.UTC(yyyy, tzDate.getUTCMonth(), tzDate.getUTCDate(), 0, 0, 0))
  const endOfDay = new Date(
    Date.UTC(yyyy, tzDate.getUTCMonth(), tzDate.getUTCDate(), 23, 59, 59, 999)
  )

  for (let attempt = 0; attempt < 3; attempt++) {
    const count = await tx.bookingGroup.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    const seq = String(count + 1).padStart(4, '0')
    const candidate = `${prefix}${seq}`

    const existing = await tx.bookingGroup.findUnique({
      where: { bookingGroupNumber: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  const random = String(Math.floor(1000 + Math.random() * 9000))
  return `${prefix}${random}`
}

const LINE_SUFFIX_RE = /-(\d{2})$/

export function parseBookingLineSuffix(bookingNumber: string): number | null {
  const m = bookingNumber.match(LINE_SUFFIX_RE)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Next `{groupNumber}-NN` for a new child row (gaps allowed when siblings were removed).
 */
export async function generateNextBookingLineNumber(
  tx: Prisma.TransactionClient,
  bookingGroupNumber: string
): Promise<string> {
  const rows = await tx.booking.findMany({
    where: { bookingGroup: { bookingGroupNumber } },
    select: { bookingNumber: true },
  })

  let max = 0
  for (const r of rows) {
    const n = parseBookingLineSuffix(r.bookingNumber)
    if (n != null) max = Math.max(max, n)
  }

  const next = max + 1
  if (next > 99) {
    throw new Error('BOOKING_LINE_LIMIT')
  }

  return `${bookingGroupNumber}-${String(next).padStart(2, '0')}`
}

/** Resolve GET/update by UUID or by WC-… reference. */
export function bookingGroupWhereByRef(
  bookingGroupRef: string
): { id: string } | { OR: [{ id: string }, { bookingGroupNumber: string }] } {
  if (bookingGroupRef.startsWith('WC-')) {
    return { OR: [{ id: bookingGroupRef }, { bookingGroupNumber: bookingGroupRef }] }
  }
  return { id: bookingGroupRef }
}
