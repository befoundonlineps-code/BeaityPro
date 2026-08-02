import {
  summariseDay,
  bucketFor,
  isInProgress,
  sessionProgress,
  SUMMARY_KEYS,
  CONFIRMED,
  PENDING,
  IN_PROGRESS,
  COMPLETED,
  CANCELLED,
  NO_SHOW,
} from './statusSummary'

const NOW = new Date('2026-08-02T12:00:00')

function row(status, overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    status,
    is_primary: true,
    start_time: '2026-08-02T09:00:00',
    end_time: '2026-08-02T10:00:00',
    ...overrides,
  }
}

const running = (overrides = {}) =>
  row('booked', { start_time: '2026-08-02T11:30:00', end_time: '2026-08-02T12:30:00', ...overrides })

describe('isInProgress', () => {
  it('is true for a booking that has started and not yet ended', () => {
    expect(isInProgress(running(), NOW)).toBe(true)
  })

  it('is false before it starts and after it ends', () => {
    expect(isInProgress(row('booked', { start_time: '2026-08-02T13:00:00', end_time: '2026-08-02T14:00:00' }), NOW)).toBe(false)
    expect(isInProgress(row('booked'), NOW)).toBe(false) // 09:00–10:00, already over
  })

  it('is false at the exact moment it ends', () => {
    // end > now, so a session finishing on the stroke of noon is over.
    expect(isInProgress(row('booked', { start_time: '2026-08-02T11:00:00', end_time: '2026-08-02T12:00:00' }), NOW)).toBe(false)
  })

  it('is true at the exact moment it starts', () => {
    expect(isInProgress(row('booked', { start_time: '2026-08-02T12:00:00', end_time: '2026-08-02T13:00:00' }), NOW)).toBe(true)
  })

  it('needs the booking to be booked, not merely happening', () => {
    // A completed session's clock says it is running; its status says it is
    // finished, and the status wins.
    expect(isInProgress(running({ status: 'completed' }), NOW)).toBe(false)
    expect(isInProgress(running({ status: 'pending_approval' }), NOW)).toBe(false)
  })

  it('says no rather than throwing when there is no row', () => {
    expect(isInProgress(null, NOW)).toBe(false)
  })
})

describe('sessionProgress', () => {
  it('reports minutes elapsed out of the whole', () => {
    // 11:30–12:30, read at noon.
    expect(sessionProgress(running(), NOW)).toEqual({
      elapsedMinutes: 30, totalMinutes: 60, ratio: 0.5,
    })
  })

  it('is nothing at all for a session that is not running', () => {
    expect(sessionProgress(row('booked'), NOW)).toBe(null)               // already over
    expect(sessionProgress(running({ status: 'completed' }), NOW)).toBe(null)
    expect(sessionProgress(null, NOW)).toBe(null)
  })

  it('starts at zero on the stroke of the hour it begins', () => {
    const p = sessionProgress(row('booked', { start_time: '2026-08-02T12:00:00', end_time: '2026-08-02T13:00:00' }), NOW)
    expect(p).toEqual({ elapsedMinutes: 0, totalMinutes: 60, ratio: 0 })
  })

  it('never exceeds the whole, whatever the clock says', () => {
    // isInProgress already keeps `now` inside the window; this keeps a bar
    // width honest if it ever does not.
    const p = sessionProgress(row('booked', { start_time: '2026-08-02T11:00:00', end_time: '2026-08-02T12:00:30' }), NOW)
    expect(p.elapsedMinutes).toBeLessThanOrEqual(p.totalMinutes)
    expect(p.ratio).toBeLessThanOrEqual(1)
  })

  it('refuses a session with no length rather than dividing by zero', () => {
    expect(sessionProgress(row('booked', { start_time: '2026-08-02T12:00:00', end_time: '2026-08-02T12:00:00' }), NOW)).toBe(null)
  })

  it('handles a long session part way through', () => {
    // 10:00–14:00 read at noon: two hours of four.
    const p = sessionProgress(row('booked', { start_time: '2026-08-02T10:00:00', end_time: '2026-08-02T14:00:00' }), NOW)
    expect(p).toEqual({ elapsedMinutes: 120, totalMinutes: 240, ratio: 0.5 })
  })
})

describe('bucketFor', () => {
  it('splits booked into confirmed and in-progress, never both', () => {
    expect(bucketFor(row('booked'), NOW)).toBe(CONFIRMED)
    expect(bucketFor(running(), NOW)).toBe(IN_PROGRESS)
  })

  it('maps the remaining stored statuses', () => {
    expect(bucketFor(row('pending_approval'), NOW)).toBe(PENDING)
    expect(bucketFor(row('completed'), NOW)).toBe(COMPLETED)
    expect(bucketFor(row('cancelled'), NOW)).toBe(CANCELLED)
    expect(bucketFor(row('no_show'), NOW)).toBe(NO_SHOW)
  })

  it('counts no history row', () => {
    // Each was replaced by a row that carries the booking forward; counting
    // both would report an appointment twice for having been moved.
    expect(bucketFor(row('rescheduled'), NOW)).toBe(null)
    expect(bucketFor(row('adjusted'), NOW)).toBe(null)
  })

  it('counts no waiting entry', () => {
    expect(bucketFor(row('waiting', { start_time: null, end_time: null }), NOW)).toBe(null)
  })
})

describe('summariseDay', () => {
  it('counts each bucket and totals them', () => {
    const rows = [
      row('booked'), row('booked'),
      row('pending_approval'),
      running(),
      row('completed'), row('completed'), row('completed'),
      row('cancelled'),
      row('no_show'),
    ]
    const { counts, total } = summariseDay(rows, NOW)
    expect(counts).toEqual({
      [CONFIRMED]: 2, [PENDING]: 1, [IN_PROGRESS]: 1,
      [COMPLETED]: 3, [CANCELLED]: 1, [NO_SHOW]: 1,
    })
    expect(total).toBe(9)
  })

  it('keeps the total equal to the sum of the parts', () => {
    // The reference bar adds up — 12+4+1+6+2+1 = 26 — which only holds while
    // the buckets stay disjoint.
    const rows = [row('booked'), running(), row('completed'), row('rescheduled'), row('adjusted')]
    const { counts, total } = summariseDay(rows, NOW)
    expect(SUMMARY_KEYS.reduce((sum, k) => sum + counts[k], 0)).toBe(total)
    expect(total).toBe(3)
  })

  it('counts a session once however many professionals work it', () => {
    // A four-hands massage is two rows and one appointment.
    const rows = [row('booked'), row('booked', { is_primary: false })]
    expect(summariseDay(rows, NOW).total).toBe(1)
  })

  it('reports zeroes rather than gaps for a quiet day', () => {
    const { counts, total } = summariseDay([], NOW)
    expect(total).toBe(0)
    for (const k of SUMMARY_KEYS) expect(counts[k]).toBe(0)
  })

  it('copes with nothing at all', () => {
    expect(summariseDay(null, NOW).total).toBe(0)
  })
})
