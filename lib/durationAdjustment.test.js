import { resolveAdjustedEnd, planDurationAdjustment } from './durationAdjustment'

const D = (iso) => new Date(iso)

describe('resolveAdjustedEnd', () => {
  const start = D('2026-08-10T14:00:00')
  const end = D('2026-08-10T15:00:00')

  it('reads the typed time against the session own day', () => {
    expect(resolveAdjustedEnd(start, end, '14:30')).toEqual(D('2026-08-10T14:30:00'))
    expect(resolveAdjustedEnd(start, end, '15:30')).toEqual(D('2026-08-10T15:30:00'))
  })

  it('refuses a time that lands before the session began', () => {
    // 13:00 is not an end at all — it is earlier than the start.
    expect(resolveAdjustedEnd(start, end, '13:00')).toBeNull()
    expect(resolveAdjustedEnd(start, end, '14:00')).toBeNull() // exactly the start
  })

  it('rolls to the next day only for a session that already crosses midnight', () => {
    const lateStart = D('2026-08-10T23:30:00')
    const lateEnd = D('2026-08-11T00:30:00')
    expect(resolveAdjustedEnd(lateStart, lateEnd, '00:45')).toEqual(D('2026-08-11T00:45:00'))
    // Still same-night times resolve on the start day, not rolled forward.
    expect(resolveAdjustedEnd(lateStart, lateEnd, '23:45')).toEqual(D('2026-08-10T23:45:00'))
  })

  it('returns null for missing or malformed input', () => {
    expect(resolveAdjustedEnd(start, end, '')).toBeNull()
    expect(resolveAdjustedEnd(start, end, 'abc')).toBeNull()
    expect(resolveAdjustedEnd(null, end, '15:30')).toBeNull()
    expect(resolveAdjustedEnd(start, null, '15:30')).toBeNull()
  })
})

describe('planDurationAdjustment', () => {
  const start = D('2026-08-10T14:00:00')
  const currentEnd = D('2026-08-10T15:00:00')
  const plan = (newEnd) => planDurationAdjustment({ start, currentEnd, newEnd })

  it('treats a later end as an extension that must be checked', () => {
    const result = plan(D('2026-08-10T15:30:00'))
    expect(result.ok).toBe(true)
    expect(result.direction).toBe('extend')
    expect(result.needsAvailabilityCheck).toBe(true)
    expect(result.minutes).toBe(90)
  })

  it('treats an earlier end as shortening, needing no check at all', () => {
    // The power-cut case: 2:00-3:00 stopped at 2:30. Handing time back
    // cannot collide with anything, so there is nothing to ask the
    // database about.
    const result = plan(D('2026-08-10T14:30:00'))
    expect(result.ok).toBe(true)
    expect(result.direction).toBe('shorten')
    expect(result.needsAvailabilityCheck).toBe(false)
    expect(result.minutes).toBe(30)
  })

  it('refuses an end at or before the start', () => {
    expect(plan(D('2026-08-10T14:00:00'))).toEqual({ ok: false, reason: 'endBeforeStart' })
    expect(plan(D('2026-08-10T13:00:00'))).toEqual({ ok: false, reason: 'endBeforeStart' })
  })

  it('refuses an end identical to the current one, which would record nothing', () => {
    expect(plan(D('2026-08-10T15:00:00'))).toEqual({ ok: false, reason: 'noChange' })
  })

  it('refuses a missing end', () => {
    expect(plan(null)).toEqual({ ok: false, reason: 'invalidEnd' })
  })

  it('counts minutes from the start, not from the original end', () => {
    // A session extended to 16:00 lasted two hours in total, not one.
    expect(plan(D('2026-08-10T16:00:00')).minutes).toBe(120)
  })
})
