import {
  BOOKING_STATE_TRANSITIONS,
  InvalidBookingTransitionError,
  assertValidTransition,
  getNextValidStates,
  isTerminalStatus,
  isValidTransition,
} from './booking-state-machine'

describe('booking state machine', () => {
  it('allows the core booking-flow transitions', () => {
    expect(isValidTransition('draft', 'request')).toBe(true)
    expect(isValidTransition('request', 'accepted')).toBe(true)
    expect(isValidTransition('request', 'declined')).toBe(true)
    expect(isValidTransition('request', 'expired')).toBe(true)
    expect(isValidTransition('accepted', 'deposit_paid')).toBe(true)
    expect(isValidTransition('fully_paid', 'at_camp')).toBe(true)
    expect(isValidTransition('at_camp', 'completed')).toBe(true)
  })

  it('rejects illegal transitions', () => {
    expect(isValidTransition('expired', 'accepted')).toBe(false)
    expect(isValidTransition('declined', 'accepted')).toBe(false)
    expect(isValidTransition('completed', 'request')).toBe(false)
    expect(isValidTransition('cancelled', 'accepted')).toBe(false)
  })

  it('always allows a same-state (idempotent) write', () => {
    expect(isValidTransition('accepted', 'accepted')).toBe(true)
    expect(isValidTransition('cancelled', 'cancelled')).toBe(true)
  })

  it('treats declined/expired/cancelled/fully_refunded as terminal', () => {
    expect(isTerminalStatus('declined')).toBe(true)
    expect(isTerminalStatus('expired')).toBe(true)
    expect(isTerminalStatus('cancelled')).toBe(true)
    expect(isTerminalStatus('fully_refunded')).toBe(true)
    expect(isTerminalStatus('request')).toBe(false)
    expect(getNextValidStates('declined')).toHaveLength(0)
  })

  it('assertValidTransition throws InvalidBookingTransitionError on illegal moves', () => {
    expect(() => assertValidTransition('request', 'accepted')).not.toThrow()
    expect(() => assertValidTransition('expired', 'accepted')).toThrow(
      InvalidBookingTransitionError
    )
  })

  it('has an entry for every status (exhaustive map)', () => {
    // Every reachable target must itself be a key in the map.
    for (const [, targets] of Object.entries(BOOKING_STATE_TRANSITIONS)) {
      for (const t of targets) {
        expect(BOOKING_STATE_TRANSITIONS[t]).toBeDefined()
      }
    }
  })
})
