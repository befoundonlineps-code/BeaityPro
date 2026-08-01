import {
  weekStartISO,
  weekDaysISO,
  shiftWeekISO,
  weekRangeParts,
  weekBounds,
  DAYS_IN_WEEK,
} from './calendarWeek'

// 2026-08-02 is a Sunday; 2026-08-08 is the Saturday that closes that week.

describe('weekStartISO', () => {
  it('leaves a Sunday where it is', () => {
    expect(weekStartISO('2026-08-02')).toBe('2026-08-02')
  })

  it('walks back to Sunday from any day in the week', () => {
    expect(weekStartISO('2026-08-05')).toBe('2026-08-02') // Wednesday
    expect(weekStartISO('2026-08-08')).toBe('2026-08-02') // Saturday
  })

  it('crosses a month backwards when the week straddles one', () => {
    // 2026-08-01 is a Saturday, so its week began the previous Sunday in July.
    expect(weekStartISO('2026-08-01')).toBe('2026-07-26')
  })

  it('crosses a year backwards', () => {
    // 2027-01-01 is a Friday.
    expect(weekStartISO('2027-01-01')).toBe('2026-12-27')
  })

  it('returns null for an unparseable date rather than a wrong week', () => {
    expect(weekStartISO('not-a-date')).toBe(null)
  })
})

describe('weekDaysISO', () => {
  it('gives seven consecutive days beginning on Sunday', () => {
    expect(weekDaysISO('2026-08-05')).toEqual([
      '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
      '2026-08-06', '2026-08-07', '2026-08-08',
    ])
  })

  it('carries across a month boundary without arithmetic of its own', () => {
    expect(weekDaysISO('2026-07-30')).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
      '2026-07-30', '2026-07-31', '2026-08-01',
    ])
  })

  it('carries across a year boundary', () => {
    expect(weekDaysISO('2026-12-31')).toEqual([
      '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30',
      '2026-12-31', '2027-01-01', '2027-01-02',
    ])
  })

  it('is always a full week', () => {
    expect(weekDaysISO('2026-08-05')).toHaveLength(DAYS_IN_WEEK)
  })

  it('gives nothing for an unparseable date', () => {
    expect(weekDaysISO('')).toEqual([])
  })
})

describe('shiftWeekISO', () => {
  it('moves exactly seven days and keeps the weekday', () => {
    expect(shiftWeekISO('2026-08-05', 1)).toBe('2026-08-12')
    expect(shiftWeekISO('2026-08-05', -1)).toBe('2026-07-29')
  })

  it('crosses a year in both directions', () => {
    expect(shiftWeekISO('2026-12-31', 1)).toBe('2027-01-07')
    expect(shiftWeekISO('2027-01-01', -1)).toBe('2026-12-25')
  })

  it('hands back what it was given when it cannot parse it', () => {
    expect(shiftWeekISO('nonsense', 1)).toBe('nonsense')
  })
})

describe('weekBounds', () => {
  it('runs from Sunday to the start of the following Sunday', () => {
    // Half-open, the same rule every other range in this codebase uses: a
    // booking at 23:30 on Saturday is inside, midnight on Sunday is not.
    const { from, to } = weekBounds('2026-08-05')
    expect(from).toEqual(new Date('2026-08-02T00:00:00'))
    expect(to).toEqual(new Date('2026-08-09T00:00:00'))
  })

  it('gives nothing for an unparseable date', () => {
    expect(weekBounds('')).toBe(null)
  })
})

describe('weekRangeParts', () => {
  it('reports one month when the week sits inside it', () => {
    const p = weekRangeParts('2026-08-05', 'ar')
    expect(p.sameMonth).toBe(true)
    expect(p.startDay).toBe(2)
    expect(p.endDay).toBe(8)
    expect(p.startYear).toBe(2026)
  })

  it('reports two months when the week straddles them', () => {
    const p = weekRangeParts('2026-07-30', 'ar')
    expect(p.sameMonth).toBe(false)
    expect(p.startDay).toBe(26)
    expect(p.endDay).toBe(1)
    expect(p.startMonth).not.toBe(p.endMonth)
  })

  it('treats the same month in different years as different', () => {
    // Nothing in this data set does that, but "same month name" must not be
    // mistaken for "same month".
    const p = weekRangeParts('2026-12-31', 'ar')
    expect(p.sameMonth).toBe(false)
    expect(p.startYear).toBe(2026)
    expect(p.endYear).toBe(2027)
  })

  it('names months through the locale rather than a table of our own', () => {
    const p = weekRangeParts('2026-08-05', 'ar')
    expect(typeof p.startMonth).toBe('string')
    expect(p.startMonth.length).toBeGreaterThan(0)
  })

  it('gives nothing for an unparseable date', () => {
    expect(weekRangeParts('', 'ar')).toBe(null)
  })
})
