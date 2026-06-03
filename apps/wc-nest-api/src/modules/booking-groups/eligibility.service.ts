import { Injectable } from '@nestjs/common'
import {
  type EligibilityCampInput,
  type EligibilityChildInput,
  type EligibilitySkillGate,
  type ExistingBookingRange,
  validateChildAgainstCamp,
} from '@world-schools/wc-utils'
import type { EligibilityResult } from '@world-schools/wc-types'
import { EligibilityMode } from '../../generated/client/enums'
import { PrismaService } from '../../prisma/prisma.service'
import { CAPACITY_CONSUMING_STATUSES } from './capacity-statuses'

/**
 * Loads the data needed to evaluate the shared `validateChildAgainstCamp`
 * eligibility engine and returns a per-child result. This is the single place
 * the API resolves camp eligibility — used by:
 *   - the authoritative gate in `BookingGroupsService.submitForParentLocked`,
 *   - the parent-facing `GET /user/camps/:id/eligibility-check` pre-validation,
 *   - the provider booking-request drawer (per-child eligibility badges).
 *
 * Pure rule logic lives in `@world-schools/wc-utils` (booking-eligibility.ts);
 * this service only does the Prisma I/O + shape mapping.
 */
@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate the given children against a camp/session. `childIds` is assumed
   * already authorized (owned by the requesting parent) by the caller.
   */
  async evaluateChildren(params: {
    campId: string
    sessionId: string
    childIds: string[]
  }): Promise<EligibilityResult[]> {
    if (params.childIds.length === 0) return []

    const [camp, session, children, existingBookings] = await Promise.all([
      this.prisma.camp.findUnique({
        where: { id: params.campId },
        select: {
          gender: true,
          ageGroups: true,
          type: true,
          eligibilityRequirements: {
            where: { mode: EligibilityMode.GATE },
            select: {
              minimumLevelValue: true,
              activity: {
                select: {
                  id: true,
                  name: true,
                  scale: { select: { levels: { select: { value: true, order: true } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.session.findUnique({
        where: { id: params.sessionId },
        select: { startDate: true, endDate: true },
      }),
      this.prisma.children.findMany({
        where: { id: { in: params.childIds } },
        select: {
          id: true,
          dateOfBirth: true,
          gender: true,
          emergencyContacts: true,
          medicalInfo: true,
          childSkills: { select: { activityId: true, levelValue: true } },
        },
      }),
      // Each child's other capacity-consuming bookings (across all sessions). The
      // pure engine filters these down to the ones whose dates actually overlap
      // the target session window. A child can't self-conflict with the booking
      // being evaluated: this method only ever runs while that booking group is a
      // `draft` (the re-submit path returns before the gate), and `draft` is not
      // in CAPACITY_CONSUMING_STATUSES, so its own rows are excluded here.
      this.prisma.booking.findMany({
        where: {
          childId: { in: params.childIds },
          bookingGroup: { status: { in: CAPACITY_CONSUMING_STATUSES } },
        },
        select: { childId: true, startDate: true, endDate: true },
      }),
    ])

    if (!camp || !session) {
      // Camp/session gone — surface as a single failure per child so callers
      // (and the UI) get a deterministic, non-eligible result.
      return params.childIds.map(childId => ({
        childId,
        eligible: false,
        failures: [{ code: 'age_out_of_range', message: 'Camp or session is unavailable.' }],
      }))
    }

    const campInput = this.toCampInput(camp)
    const sessionStart = session.startDate

    const bookingsByChild = new Map<string, ExistingBookingRange[]>()
    for (const booking of existingBookings) {
      const list = bookingsByChild.get(booking.childId) ?? []
      list.push({ startDate: booking.startDate, endDate: booking.endDate })
      bookingsByChild.set(booking.childId, list)
    }

    return children.map(child =>
      validateChildAgainstCamp(this.toChildInput(child), campInput, sessionStart, {
        sessionEnd: session.endDate,
        existingBookings: bookingsByChild.get(child.id) ?? [],
      })
    )
  }

  private toCampInput(camp: {
    gender: string
    ageGroups: unknown
    type: string
    eligibilityRequirements: {
      minimumLevelValue: string | null
      activity: {
        id: string
        name: string
        scale: { levels: { value: string; order: number }[] } | null
      }
    }[]
  }): EligibilityCampInput {
    const ageGroups = Array.isArray(camp.ageGroups)
      ? (camp.ageGroups as { min?: number; max?: number }[])
          .filter(g => typeof g?.min === 'number' && typeof g?.max === 'number')
          .map(g => ({ min: g.min as number, max: g.max as number }))
      : []

    const skillGates: EligibilitySkillGate[] = camp.eligibilityRequirements
      .filter(r => r.minimumLevelValue && r.activity.scale)
      .map(r => ({
        activityId: r.activity.id,
        activityName: r.activity.name,
        minimumLevelValue: r.minimumLevelValue as string,
        scaleLevels: r.activity.scale!.levels.map(l => ({ value: l.value, order: l.order })),
      }))

    return {
      gender: camp.gender as EligibilityCampInput['gender'],
      ageGroups,
      isResidential: camp.type === 'residential',
      skillGates,
    }
  }

  private toChildInput(child: {
    id: string
    dateOfBirth: Date | null
    gender: string | null
    emergencyContacts: unknown
    medicalInfo: unknown
    childSkills: { activityId: string; levelValue: string }[]
  }): EligibilityChildInput {
    return {
      id: child.id,
      dateOfBirth: child.dateOfBirth,
      gender: child.gender,
      emergencyContacts: child.emergencyContacts,
      medicalInfo: child.medicalInfo,
      skills: child.childSkills.map(s => ({ activityId: s.activityId, levelValue: s.levelValue })),
    }
  }
}
