import {
  canShowQuickActions,
  canShowProgressText,
  approveErrorKey,
  MIN_HEIGHT_FOR_ACTIONS,
  MIN_HEIGHT_FOR_PROGRESS_TEXT,
} from './appointmentCard'

// A block is (duration / 30) × 40px on this grid.
const heightFor = (minutes) => (minutes / 30) * 40

describe('canShowQuickActions', () => {
  const call = (over = {}) =>
    canShowQuickActions({ status: 'pending_approval', height: heightFor(60), hasHandler: true, ...over })

  it('offers the shortcut on a provisional booking with room', () => {
    expect(call()).toBe(true)
  })

  it('refuses it on a block too short to draw it', () => {
    // Measured, not guessed: two text lines 29px plus a button row 17px.
    // A half-hour booking is 40px and would clip the row silently.
    expect(call({ height: heightFor(30) })).toBe(false)
    expect(call({ height: heightFor(25) })).toBe(false)
    expect(call({ height: heightFor(1) })).toBe(false)
  })

  it('offers it from the threshold upward', () => {
    expect(call({ height: MIN_HEIGHT_FOR_ACTIONS })).toBe(true)
    expect(call({ height: MIN_HEIGHT_FOR_ACTIONS - 1 })).toBe(false)
    expect(call({ height: heightFor(40) })).toBe(true)
  })

  it('offers it only for a booking awaiting approval', () => {
    for (const status of ['booked', 'completed', 'cancelled', 'no_show', 'waiting']) {
      expect(call({ status })).toBe(false)
    }
  })

  it('stays away when the caller wired no handler', () => {
    // The week and day grids both pass one; anything that does not gets the
    // old card rather than a button that does nothing.
    expect(call({ hasHandler: false })).toBe(false)
  })
})

describe('canShowProgressText', () => {
  it('needs room for a third line', () => {
    expect(canShowProgressText(MIN_HEIGHT_FOR_PROGRESS_TEXT)).toBe(true)
    expect(canShowProgressText(MIN_HEIGHT_FOR_PROGRESS_TEXT - 1)).toBe(false)
  })

  it('fits on an ordinary booking but not the shortest', () => {
    expect(canShowProgressText(heightFor(45))).toBe(true)
    expect(canShowProgressText(heightFor(25))).toBe(false)
  })
})

describe('approveErrorKey', () => {
  it('names the refusal the database gives', () => {
    expect(approveErrorKey({ error: { message: 'appointment_not_pending' } }))
      .toBe('appointments:actionsDialog.notPendingError')
  })

  it('hands an unrecognised error back for the generic path', () => {
    // null means "I have nothing better to say" — the caller falls through to
    // reportDbError, which both logs it and translates it.
    expect(approveErrorKey({ error: { message: 'something else' } })).toBe(null)
    expect(approveErrorKey({ error: {} })).toBe(null)
  })

  it('catches a call that changed nothing', () => {
    expect(approveErrorKey({ data: null })).toBe('appointments:actionsDialog.noRowsError')
  })

  it('says nothing when it worked', () => {
    expect(approveErrorKey({ data: 'some-group-id' })).toBe(null)
  })
})
