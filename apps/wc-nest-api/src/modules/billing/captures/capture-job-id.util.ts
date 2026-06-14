/**
 * Deterministic BullMQ jobId for a scheduled capture. One job per
 * `(bookingGroupId, sequence)` — matching the `@@unique` anchor on
 * `booking_scheduled_captures` — so enqueue is idempotent and the job is
 * addressable for removal on cancellation.
 *
 * BullMQ rejects custom ids containing ':' (same constraint the notifications
 * enqueue service sanitizes for), so we join with '_'.
 */
export function buildCaptureJobId(bookingGroupId: string, sequence: number): string {
  return `capture_${bookingGroupId}_${sequence}`
}
