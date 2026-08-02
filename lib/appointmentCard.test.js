import {
  cardContent,
  showsConfirmedTick,
  timeRangeLabel,
  approveErrorKey,
} from './appointmentCard'

// A block is (duration / 30) × 40px on this grid.
const h = (minutes) => (minutes / 30) * 40

const content = (over = {}) =>
  cardContent({ height: h(60), status: 'booked', isRunning: false, hasApproveHandler: true, ...over })

describe('cardContent — what fits', () => {
  it('shows everything on a long booking', () => {
    expect(content({ height: h(90), isRunning: true })).toEqual({
      showActions: false, showTime: true, showProgress: true,
    })
  })

  it('drops the time before the name and service on a short block', () => {
    // 2 lines need 29px, 3 need 41.5px. A half-hour block is 40px.
    expect(content({ height: h(30) }).showTime).toBe(false)
    expect(content({ height: h(45) }).showTime).toBe(true)
  })

  it('shows nothing extra at all on the shortest blocks', () => {
    expect(content({ height: h(1), isRunning: true })).toEqual({
      showActions: false, showTime: false, showProgress: false,
    })
  })

  describe('a pending block', () => {
    const pending = (height) => content({ height, status: 'pending_approval' })

    it('gets its buttons once two lines and the row fit', () => {
      // 29px of text plus a 17px row.
      expect(pending(h(30)).showActions).toBe(false)   // 40px
      expect(pending(h(40)).showActions).toBe(true)    // 53px
    })

    it('holds the time back until it clears the button row too', () => {
      // This is why the two cannot be decided separately: 53px is enough for
      // buttons, and would overflow the moment a third line was added under
      // a rule that had not heard of them.
      expect(pending(h(40))).toMatchObject({ showActions: true, showTime: false })
      expect(pending(h(60))).toMatchObject({ showActions: true, showTime: true })
    })

    it('offers no buttons without a handler, and then has room for the time', () => {
      const noHandler = content({ height: h(40), status: 'pending_approval', hasApproveHandler: false })
      expect(noHandler).toMatchObject({ showActions: false, showTime: true })
    })
  })

  describe('a running session', () => {
    it('puts progress on the fourth line when the time is showing', () => {
      // 4 lines need 54px — a 45-minute block is 60px, a 40-minute one 53px.
      expect(content({ height: h(45), isRunning: true })).toMatchObject({ showTime: true, showProgress: true })
      expect(content({ height: h(40), isRunning: true })).toMatchObject({ showTime: true, showProgress: false })
    })

    it('shows no progress for a session that is not running', () => {
      expect(content({ height: h(90), isRunning: false }).showProgress).toBe(false)
    })
  })
})

describe('showsConfirmedTick', () => {
  it('marks only a settled booking', () => {
    expect(showsConfirmedTick('booked')).toBe(true)
  })

  it('leaves everything else unmarked', () => {
    // Provisional has its dashed edge and its buttons; the rest is history.
    for (const s of ['pending_approval', 'completed', 'cancelled', 'no_show', 'waiting']) {
      expect(showsConfirmedTick(s)).toBe(false)
    }
  })
})

describe('timeRangeLabel', () => {
  it('reads the booking’s own span', () => {
    expect(timeRangeLabel({ start_time: '2026-08-02T09:00:00', end_time: '2026-08-02T10:30:00' }))
      .toBe('09:00 – 10:30')
  })

  it('pads both sides', () => {
    expect(timeRangeLabel({ start_time: '2026-08-02T09:05:00', end_time: '2026-08-02T18:00:00' }))
      .toBe('09:05 – 18:00')
  })

  it('says nothing for a booking with no span', () => {
    // A waiting entry has neither, and gets no label rather than "Invalid".
    expect(timeRangeLabel({ start_time: null, end_time: null })).toBe(null)
    expect(timeRangeLabel(null)).toBe(null)
  })
})

describe('approveErrorKey', () => {
  it('names the refusal the database gives', () => {
    expect(approveErrorKey({ error: { message: 'appointment_not_pending' } }))
      .toBe('appointments:actionsDialog.notPendingError')
  })

  it('hands an unrecognised error back for the generic path', () => {
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
