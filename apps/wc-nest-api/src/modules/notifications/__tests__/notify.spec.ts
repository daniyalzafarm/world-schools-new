import { NotificationType } from '@world-schools/wc-types'
import { NOTIFICATION_DISPATCH_EVENT, notify } from '../dispatcher/notify'

describe('notify() helper (Phase 14c hardening)', () => {
  it('emits the canonical event payload to the EventEmitter', () => {
    const emit = jest.fn()
    const events = { emit } as never

    notify(events, NotificationType.ParentBookingAccepted, { bookingGroupId: 'BG-1' })

    expect(emit).toHaveBeenCalledWith(NOTIFICATION_DISPATCH_EVENT, {
      type: NotificationType.ParentBookingAccepted,
      context: { bookingGroupId: 'BG-1' },
      runAt: undefined,
    })
  })

  it('passes runAt through unchanged for scheduled triggers', () => {
    const emit = jest.fn()
    const runAt = new Date(Date.now() + 60_000)

    notify({ emit } as never, NotificationType.ParentBookingAccepted, {}, runAt)

    expect(emit).toHaveBeenCalledWith(
      NOTIFICATION_DISPATCH_EVENT,
      expect.objectContaining({ runAt })
    )
  })

  it('swallows EventEmitter exceptions so a domain commit never fails on notification dispatch', () => {
    const emit = jest.fn().mockImplementation(() => {
      throw new Error('listener exploded')
    })

    // Must NOT throw — caller is in the middle of a booking acceptance.
    expect(() =>
      notify({ emit } as never, NotificationType.ParentBookingAccepted, { bookingGroupId: 'BG-1' })
    ).not.toThrow()

    expect(emit).toHaveBeenCalled()
  })
})
