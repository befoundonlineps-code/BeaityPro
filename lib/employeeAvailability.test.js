import {
  recurringWindowForDate,
  availableWindowsForDate,
  dayHoursForDate,
  isAbsentOn,
  isWithinWindow,
  isWithinAnyWindow,
  exceptionWindowFor,
  PREP_MINUTES,
} from './employeeAvailability'

describe('recurringWindowForDate', () => {
  it('returns null when the employee has no schedule at all', () => {
    expect(recurringWindowForDate(null, [], new Date('2026-07-28'))).toBeNull()
  })

  describe('weekly pattern', () => {
    const schedule = { pattern_type: 'weekly' }
    const slots = [
      { slot_key: '0', is_active: true, start_time: '09:00:00', end_time: '18:00:00' }, // Sunday
      { slot_key: '1', is_active: false, start_time: '09:00:00', end_time: '18:00:00' }, // Monday off
    ]

    it('returns the window for an active day', () => {
      const sunday = new Date('2026-08-02T00:00:00') // a Sunday
      expect(recurringWindowForDate(schedule, slots, sunday)).toEqual({ startTime: '09:00', endTime: '18:00' })
    })

    it('returns null for a day marked inactive', () => {
      const monday = new Date('2026-08-03T00:00:00')
      expect(recurringWindowForDate(schedule, slots, monday)).toBeNull()
    })

    it('returns null for a day with no slot row at all', () => {
      const tuesday = new Date('2026-08-04T00:00:00')
      expect(recurringWindowForDate(schedule, slots, tuesday)).toBeNull()
    })
  })

  describe('even_odd pattern', () => {
    const schedule = { pattern_type: 'even_odd', starts_on: '2026-08-01' }
    const slots = [
      { slot_key: 'even', is_active: true, start_time: '10:00:00', end_time: '16:00:00' },
      { slot_key: 'odd', is_active: true, start_time: '08:00:00', end_time: '14:00:00' },
    ]

    it('picks the even slot on the start day and every other day after', () => {
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-01'))).toEqual({ startTime: '10:00', endTime: '16:00' })
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-03'))).toEqual({ startTime: '10:00', endTime: '16:00' })
    })

    it('picks the odd slot on the day after the start day', () => {
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-02'))).toEqual({ startTime: '08:00', endTime: '14:00' })
    })

    it('returns null before the schedule started', () => {
      expect(recurringWindowForDate(schedule, slots, new Date('2026-07-31'))).toBeNull()
    })
  })

  describe('cycle pattern', () => {
    // 2 work days, 4-day cycle: work, work, off, off, repeat
    const schedule = { pattern_type: 'cycle', starts_on: '2026-08-01', work_days_count: 2, cycle_length_days: 4 }
    const slots = [{ slot_key: 'work', is_active: true, start_time: '09:00:00', end_time: '17:00:00' }]

    it('is a work day on positions 0 and 1 of the cycle', () => {
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-01'))).toEqual({ startTime: '09:00', endTime: '17:00' })
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-02'))).toEqual({ startTime: '09:00', endTime: '17:00' })
    })

    it('is off on positions 2 and 3, then works again on the next cycle', () => {
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-03'))).toBeNull()
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-04'))).toBeNull()
      expect(recurringWindowForDate(schedule, slots, new Date('2026-08-05'))).toEqual({ startTime: '09:00', endTime: '17:00' })
    })
  })
})

describe('availableWindowsForDate', () => {
  const schedule = { pattern_type: 'weekly' }
  const slots = [{ slot_key: '0', is_active: true, start_time: '09:00:00', end_time: '17:00:00' }]
  const sunday = new Date('2026-08-02T00:00:00')
  const exception = (date, from, to) => ({ exception_date: date, start_time: from, end_time: to })

  it('is just the recurring window when there are no exceptions', () => {
    expect(availableWindowsForDate(schedule, slots, [], sunday)).toEqual([{ startTime: '09:00', endTime: '17:00' }])
    expect(availableWindowsForDate(schedule, slots, null, sunday)).toHaveLength(1)
  })

  it('ignores exceptions belonging to another date', () => {
    const rows = [exception('2026-08-03', '19:50:00', '20:40:00')]
    expect(availableWindowsForDate(schedule, slots, rows, sunday)).toEqual([{ startTime: '09:00', endTime: '17:00' }])
  })

  it('adds a separate window for an exception with a gap, without swallowing the gap', () => {
    const rows = [exception('2026-08-02', '19:50:00', '20:40:00')]
    expect(availableWindowsForDate(schedule, slots, rows, sunday)).toEqual([
      { startTime: '09:00', endTime: '17:00' },
      { startTime: '19:50', endTime: '20:40' },
    ])
    // The whole point of keeping them apart: 18:00 stays closed.
    expect(isWithinAnyWindow(availableWindowsForDate(schedule, slots, rows, sunday), '18:00', '18:30')).toBe(false)
  })

  it('merges an exception that touches the shift, so the seam is bookable', () => {
    const rows = [exception('2026-08-02', '17:00:00', '18:00:00')]
    const windows = availableWindowsForDate(schedule, slots, rows, sunday)
    expect(windows).toEqual([{ startTime: '09:00', endTime: '18:00' }])
    expect(isWithinAnyWindow(windows, '16:45', '17:15')).toBe(true)
  })

  it('merges an exception that overlaps the shift', () => {
    const rows = [exception('2026-08-02', '16:30:00', '19:00:00')]
    expect(availableWindowsForDate(schedule, slots, rows, sunday)).toEqual([{ startTime: '09:00', endTime: '19:00' }])
  })

  it('keeps an early and a late exception from opening the whole day', () => {
    const rows = [
      exception('2026-08-02', '06:50:00', '07:30:00'),
      exception('2026-08-02', '19:50:00', '20:40:00'),
    ]
    const windows = availableWindowsForDate(schedule, slots, rows, sunday)
    expect(windows).toEqual([
      { startTime: '06:50', endTime: '07:30' },
      { startTime: '09:00', endTime: '17:00' },
      { startTime: '19:50', endTime: '20:40' },
    ])
    expect(isWithinAnyWindow(windows, '08:00', '08:30')).toBe(false)
  })

  it('gives an employee with no recurring schedule just the exception window', () => {
    const rows = [exception('2026-08-02', '19:50:00', '20:40:00')]
    expect(availableWindowsForDate(null, [], rows, sunday)).toEqual([{ startTime: '19:50', endTime: '20:40' }])
  })

  describe('hand-set hours for one day', () => {
    const hours = (date, from, to) => [{ work_date: date, start_time: from, end_time: to }]

    it('replaces the pattern rather than joining it, so the day can shrink', () => {
      // Added as another window this could only ever lengthen the day, and
      // "11:00–15:00 instead of 09:00–17:00" would be unsayable.
      expect(availableWindowsForDate(schedule, slots, [], sunday, null, hours('2026-08-02', '11:00:00', '15:00:00')))
        .toEqual([{ startTime: '11:00', endTime: '15:00' }])
    })

    it('can lengthen the day too', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, null, hours('2026-08-02', '07:00:00', '21:00:00')))
        .toEqual([{ startTime: '07:00', endTime: '21:00' }])
    })

    it('leaves other days on the pattern', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, null, hours('2026-08-03', '11:00:00', '15:00:00')))
        .toEqual([{ startTime: '09:00', endTime: '17:00' }])
    })

    it('still lets a shift exception add on top of the new hours', () => {
      // The exception exists to keep a confirmed booking inside an open
      // window, and that stays true whatever the shift was changed to.
      const rows = [exception('2026-08-02', '19:50:00', '20:40:00')]
      expect(availableWindowsForDate(schedule, slots, rows, sunday, null, hours('2026-08-02', '11:00:00', '15:00:00')))
        .toEqual([
          { startTime: '11:00', endTime: '15:00' },
          { startTime: '19:50', endTime: '20:40' },
        ])
    })

    it('gives an employee with no pattern at all a day out of nothing', () => {
      expect(availableWindowsForDate(null, [], [], sunday, null, hours('2026-08-02', '10:00:00', '14:00:00')))
        .toEqual([{ startTime: '10:00', endTime: '14:00' }])
    })

    it('loses to an absence, like everything else that adds', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, [{ absence_date: '2026-08-02' }], hours('2026-08-02', '11:00:00', '15:00:00')))
        .toEqual([])
    })

    it('changes nothing when the argument is missing entirely', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, null))
        .toEqual([{ startTime: '09:00', endTime: '17:00' }])
    })
  })

  describe('absence', () => {
    const absent = (date) => [{ absence_date: date }]

    it('closes the whole day, shift and all', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, absent('2026-08-02'))).toEqual([])
    })

    it('outvotes a shift exception rather than merging with it', () => {
      // The two are opposite operations. A booking confirmed out-of-hours
      // last week must not hold a window open on a day she is not coming in.
      const rows = [exception('2026-08-02', '19:50:00', '20:40:00')]
      expect(availableWindowsForDate(schedule, slots, rows, sunday, absent('2026-08-02'))).toEqual([])
    })

    it('leaves other days alone', () => {
      expect(availableWindowsForDate(schedule, slots, [], sunday, absent('2026-08-03'))).toEqual([
        { startTime: '09:00', endTime: '17:00' },
      ])
    })

    it('changes nothing when the argument is missing entirely', () => {
      // Every existing call site passed four arguments before this existed.
      expect(availableWindowsForDate(schedule, slots, [], sunday)).toEqual([
        { startTime: '09:00', endTime: '17:00' },
      ])
    })
  })
})

describe('dayHoursForDate', () => {
  const sunday = new Date('2026-08-02T00:00:00')
  const row = (date) => ({ work_date: date, start_time: '11:00:00', end_time: '15:00:00' })

  it('matches only the exact calendar day, and trims the seconds', () => {
    expect(dayHoursForDate([row('2026-08-02')], sunday)).toEqual({ startTime: '11:00', endTime: '15:00' })
    expect(dayHoursForDate([row('2026-08-01')], sunday)).toBe(null)
  })

  it('finds the day among several', () => {
    expect(dayHoursForDate([row('2026-07-30'), row('2026-08-02')], sunday)).not.toBe(null)
  })

  it('says nothing rather than throwing when there is nothing', () => {
    expect(dayHoursForDate(null, sunday)).toBe(null)
    expect(dayHoursForDate([], sunday)).toBe(null)
    expect(dayHoursForDate(undefined, sunday)).toBe(null)
  })
})

describe('isAbsentOn', () => {
  const sunday = new Date('2026-08-02T00:00:00')

  it('matches only the exact calendar day', () => {
    expect(isAbsentOn([{ absence_date: '2026-08-02' }], sunday)).toBe(true)
    expect(isAbsentOn([{ absence_date: '2026-08-01' }], sunday)).toBe(false)
  })

  it('finds the day among several absences', () => {
    const rows = [{ absence_date: '2026-07-30' }, { absence_date: '2026-08-02' }]
    expect(isAbsentOn(rows, sunday)).toBe(true)
  })

  it('says no rather than throwing when there is nothing', () => {
    expect(isAbsentOn(null, sunday)).toBe(false)
    expect(isAbsentOn([], sunday)).toBe(false)
    expect(isAbsentOn(undefined, sunday)).toBe(false)
  })
})

describe('isWithinWindow', () => {
  const window = { startTime: '09:00', endTime: '18:00' }

  it('accepts a range fully inside the window', () => {
    expect(isWithinWindow(window, '09:00', '10:00')).toBe(true)
    expect(isWithinWindow(window, '17:30', '18:00')).toBe(true)
  })

  it('rejects a range that starts before or ends after the window', () => {
    expect(isWithinWindow(window, '08:30', '09:30')).toBe(false)
    expect(isWithinWindow(window, '17:30', '18:30')).toBe(false)
  })

  it('rejects everything when there is no window', () => {
    expect(isWithinWindow(null, '10:00', '11:00')).toBe(false)
  })
})

describe('isWithinAnyWindow', () => {
  const windows = [
    { startTime: '09:00', endTime: '17:00' },
    { startTime: '19:50', endTime: '20:40' },
  ]

  it('accepts a range inside either window', () => {
    expect(isWithinAnyWindow(windows, '10:00', '11:00')).toBe(true)
    expect(isWithinAnyWindow(windows, '20:00', '20:40')).toBe(true)
  })

  it('rejects a range in the gap between them', () => {
    expect(isWithinAnyWindow(windows, '18:00', '18:30')).toBe(false)
  })

  it('rejects when there are no windows at all', () => {
    expect(isWithinAnyWindow([], '10:00', '11:00')).toBe(false)
    expect(isWithinAnyWindow(null, '10:00', '11:00')).toBe(false)
  })
})

describe('exceptionWindowFor', () => {
  const at = (hhmmss) => new Date(`2026-08-02T${hhmmss}`)

  it('opens PREP_MINUTES before the booking and closes with it', () => {
    expect(exceptionWindowFor(at('20:00:00'), at('20:40:00'))).toEqual({
      date: '2026-08-02',
      startTime: '19:50:00',
      endTime: '20:40:00',
    })
    expect(PREP_MINUTES).toBe(10)
  })

  it('keeps the seconds of a mid-minute start, so the window still covers it', () => {
    const w = exceptionWindowFor(at('20:03:00'), at('20:43:00'))
    expect(w.startTime).toBe('19:53:00')
    expect(w.endTime).toBe('20:43:00')
  })

  it('clamps to midnight rather than backing into the previous day', () => {
    expect(exceptionWindowFor(at('00:05:00'), at('00:45:00'))).toEqual({
      date: '2026-08-02',
      startTime: '00:00:00',
      endTime: '00:45:00',
    })
  })

  it('clamps an end that spills into the next day', () => {
    const w = exceptionWindowFor(at('23:30:00'), new Date('2026-08-03T00:30:00'))
    expect(w.date).toBe('2026-08-02')
    expect(w.startTime).toBe('23:20:00')
    expect(w.endTime).toBe('23:59:59')
  })

  it('always produces end after start, which the table requires', () => {
    for (const [from, to] of [['00:05:00', '00:45:00'], ['20:00:00', '20:40:00'], ['23:30:00', '23:59:00']]) {
      const w = exceptionWindowFor(at(from), at(to))
      expect(w.endTime > w.startTime).toBe(true)
    }
  })
})
