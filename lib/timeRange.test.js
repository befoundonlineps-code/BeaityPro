import { formatTimeRange } from './timeRange'

describe('formatTimeRange', () => {
  it('reads a booking’s own span', () => {
    expect(formatTimeRange('2026-08-02T09:00:00', '2026-08-02T10:30:00')).toBe('09:00 – 10:30')
  })

  it('pads both sides', () => {
    expect(formatTimeRange('2026-08-02T09:05:00', '2026-08-02T18:00:00')).toBe('09:05 – 18:00')
  })

  it('stays on a twenty-four hour clock', () => {
    // No AM/PM marker anywhere, so the afternoon has to be legible from the
    // hour alone — which is the whole reason the marker is not missed.
    expect(formatTimeRange('2026-08-02T13:00:00', '2026-08-02T20:45:00')).toBe('13:00 – 20:45')
    expect(formatTimeRange('2026-08-02T00:00:00', '2026-08-02T00:30:00')).toBe('00:00 – 00:30')
  })

  it('takes Date objects as readily as strings', () => {
    // AdjustDurationDialog works in Dates, everything else in ISO strings.
    expect(formatTimeRange(new Date(2026, 7, 2, 10, 44), new Date(2026, 7, 2, 11, 29)))
      .toBe('10:44 – 11:29')
  })

  it('takes a different separator without changing anything else', () => {
    expect(formatTimeRange('2026-08-02T10:44:00', '2026-08-02T11:29:00', ' — '))
      .toBe('10:44 — 11:29')
  })

  it('says nothing at all unless it has both ends', () => {
    expect(formatTimeRange(null, '2026-08-02T11:29:00')).toBe(null)
    expect(formatTimeRange('2026-08-02T10:44:00', null)).toBe(null)
    expect(formatTimeRange(null, null)).toBe(null)
    expect(formatTimeRange(undefined, undefined)).toBe(null)
  })

  it('says nothing for a value that is not a time', () => {
    expect(formatTimeRange('not a date', '2026-08-02T11:29:00')).toBe(null)
  })
})
