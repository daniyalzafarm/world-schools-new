import {
  type ExistingBookingRange,
  getSessionAgeGroups,
  validateChildAgainstCamp,
} from '@world-schools/wc-utils'
import type { ChildBookingRange, EligibilityFailureCode } from '@world-schools/wc-types'
import type { Camp } from '@/types/camps'
import { type Child, getChildAge } from '@/types/child'
import type { Session } from '@/types/sessions'

export interface IneligibleReason {
  code: EligibilityFailureCode
  message: string
  /**
   * The actionable noun phrase inside `message` (e.g. "emergency contact") that
   * should be rendered as a link, or null when the blocker isn't fixable by
   * editing the profile. Only this phrase links — not the whole sentence.
   */
  linkText: string | null
  /** Deep-link target for `linkText`, or null when there's nothing to link. */
  href: string | null
}

export interface ChildEligibility {
  child: Child
  age: number | null
  isEligible: boolean
  /** Every blocker, so the UI can list them all and the parent fixes them in one go. */
  ineligibleReasons: IneligibleReason[]
}

/**
 * For the fixable readiness blockers, the noun phrase within the message to
 * linkify and the child-profile section that resolves it. Age/gender mismatches
 * are hard constraints with no editable field, so they're absent here and render
 * as plain text.
 */
const REASON_LINKS: Partial<Record<EligibilityFailureCode, { text: string; section: string }>> = {
  no_emergency_contact: { text: 'emergency contact', section: 'emergency' },
  medical_required: { text: 'medical information', section: 'medical' },
  dob_missing: { text: 'date of birth', section: 'profile' },
}

/** Group the parent's existing booking windows by child id. */
function groupRangesByChild(ranges: ChildBookingRange[]): Map<string, ExistingBookingRange[]> {
  const byChild = new Map<string, ExistingBookingRange[]>()
  for (const r of ranges) {
    const list = byChild.get(r.childId) ?? []
    list.push({ startDate: r.startDate, endDate: r.endDate })
    byChild.set(r.childId, list)
  }
  return byChild
}

/**
 * Mirror the backend eligibility gate client-side for instant feedback:
 * real camp age groups + gender + readiness (DOB / emergency contact /
 * residential medical) + the existing-booking date-overlap check (when
 * `childBookingRanges` is supplied). Skill GATEs are evaluated authoritatively
 * by the backend (the FE lacks the child's skill levels), so they're omitted
 * here.
 *
 * Single source of truth shared by the step-2 ChildrenStep UI, the mobile
 * footer's Continue gate, and the store's auto-select, so all three agree on
 * exactly which children are eligible.
 */
export function getChildrenEligibility(
  camp: Camp | null,
  session: Session | null | undefined,
  children: Child[],
  childBookingRanges: ChildBookingRange[] = []
): ChildEligibility[] {
  // Use the selected session's age band — the subset of camp age groups it
  // actually offers — not the camp-wide range, so a child outside the session's
  // band is correctly blocked.
  const ageGroups = getSessionAgeGroups(camp?.ageGroups, session)
  const campInput = {
    gender: (camp?.gender ?? 'coed') as 'coed' | 'boys' | 'girls',
    ageGroups,
    isResidential: camp?.type === 'residential',
    skillGates: [],
  }
  const sessionStart = session?.startDate ?? new Date()
  const rangesByChild = groupRangesByChild(childBookingRanges)
  return children.map(child => {
    const age = getChildAge(child)
    const result = validateChildAgainstCamp(
      {
        id: child.id,
        dateOfBirth: child.dateOfBirth,
        gender: child.gender,
        emergencyContacts: child.emergencyContacts,
        medicalInfo: child.medicalInfo,
        skills: [],
      },
      campInput,
      sessionStart,
      { sessionEnd: session?.endDate, existingBookings: rangesByChild.get(child.id) ?? [] }
    )
    return {
      child,
      age,
      isEligible: result.eligible,
      ineligibleReasons: result.failures.map(f => {
        const link = REASON_LINKS[f.code]
        return {
          code: f.code,
          message: f.message,
          linkText: link?.text ?? null,
          href: link ? `/account/children/${child.id}/${link.section}` : null,
        }
      }),
    }
  })
}

/** IDs of children that pass the eligibility gate. */
export function getEligibleChildIds(
  camp: Camp | null,
  session: Session | null | undefined,
  children: Child[],
  childBookingRanges: ChildBookingRange[] = []
): string[] {
  return getChildrenEligibility(camp, session, children, childBookingRanges)
    .filter(e => e.isEligible)
    .map(e => e.child.id)
}

/** True when at least one currently-selected child is actually eligible. */
export function hasEligibleSelection(
  camp: Camp | null,
  session: Session | null | undefined,
  children: Child[],
  selectedChildIds: string[],
  childBookingRanges: ChildBookingRange[] = []
): boolean {
  const selected = new Set(selectedChildIds)
  return getChildrenEligibility(camp, session, children, childBookingRanges).some(
    e => e.isEligible && selected.has(e.child.id)
  )
}
