import { shiftSummary } from './shiftSummary'

const window_ = (startTime, endTime) => ({ startTime, endTime })

describe('shiftSummary', () => {
  it('reads a single shift as one range', () => {
    expect(shiftSummary([window_('09:00', '18:00')], 'en-US')).toBe('9:00 AM – 6:00 PM')
  })

  it('keeps both halves of a split shift', () => {
    // Collapsing to first-start and last-end would claim the gap in the
    // middle is working time.
    expect(shiftSummary([window_('09:00', '13:00'), window_('16:00', '19:00')], 'en-US'))
      .toBe('9:00 AM – 1:00 PM، 4:00 PM – 7:00 PM')
  })

  it('says nothing at all rather than an empty range when there is no shift', () => {
    // A day off is a different statement from "0:00 – 0:00", and the caller
    // renders it as its own label.
    expect(shiftSummary([], 'en-US')).toBe(null)
    expect(shiftSummary(null, 'en-US')).toBe(null)
    expect(shiftSummary(undefined, 'en-US')).toBe(null)
  })

  it('needs no special case for an absence', () => {
    // The veto upstream empties the windows, so being off arrives here as an
    // empty list and this function never learns absences exist.
    expect(shiftSummary([], 'en-US')).toBe(null)
  })

  it('handles midnight and noon without an off-by-twelve', () => {
    expect(shiftSummary([window_('00:00', '12:00')], 'en-US')).toBe('12:00 AM – 12:00 PM')
  })

  it('formats through the locale rather than a table of our own', () => {
    const arabic = shiftSummary([window_('09:00', '18:00')], 'ar')
    expect(typeof arabic).toBe('string')
    expect(arabic.length).toBeGreaterThan(0)
    expect(arabic).toContain('–')
  })

  it('lets the caller choose the separators', () => {
    expect(shiftSummary([window_('09:00', '18:00')], 'en-US', ' to ')).toBe('9:00 AM to 6:00 PM')
  })
})
