import { availableWindowForDate, isWithinWindow } from './employeeAvailability'

describe('availableWindowForDate', () => {
  it('returns null when the employee has no schedule at all', () => {
    expect(availableWindowForDate(null, [], new Date('2026-07-28'))).toBeNull()
  })

  describe('weekly pattern', () => {
    const schedule = { pattern_type: 'weekly' }
    const slots = [
      { slot_key: '0', is_active: true, start_time: '09:00:00', end_time: '18:00:00' }, // Sunday
      { slot_key: '1', is_active: false, start_time: '09:00:00', end_time: '18:00:00' }, // Monday off
    ]

    it('returns the window for an active day', () => {
      const sunday = new Date('2026-08-02T00:00:00') // a Sunday
      expect(availableWindowForDate(schedule, slots, sunday)).toEqual({ startTime: '09:00', endTime: '18:00' })
    })

    it('returns null for a day marked inactive', () => {
      const monday = new Date('2026-08-03T00:00:00')
      expect(availableWindowForDate(schedule, slots, monday)).toBeNull()
    })

    it('returns null for a day with no slot row at all', () => {
      const tuesday = new Date('2026-08-04T00:00:00')
      expect(availableWindowForDate(schedule, slots, tuesday)).toBeNull()
    })
  })

  describe('even_odd pattern', () => {
    const schedule = { pattern_type: 'even_odd', starts_on: '2026-08-01' }
    const slots = [
      { slot_key: 'even', is_active: true, start_time: '10:00:00', end_time: '16:00:00' },
      { slot_key: 'odd', is_active: true, start_time: '08:00:00', end_time: '14:00:00' },
    ]

    it('picks the even slot on the start day and every other day after', () => {
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-01'))).toEqual({ startTime: '10:00', endTime: '16:00' })
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-03'))).toEqual({ startTime: '10:00', endTime: '16:00' })
    })

    it('picks the odd slot on the day after the start day', () => {
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-02'))).toEqual({ startTime: '08:00', endTime: '14:00' })
    })

    it('returns null before the schedule started', () => {
      expect(availableWindowForDate(schedule, slots, new Date('2026-07-31'))).toBeNull()
    })
  })

  describe('cycle pattern', () => {
    // 2 work days, 4-day cycle: work, work, off, off, repeat
    const schedule = { pattern_type: 'cycle', starts_on: '2026-08-01', work_days_count: 2, cycle_length_days: 4 }
    const slots = [{ slot_key: 'work', is_active: true, start_time: '09:00:00', end_time: '17:00:00' }]

    it('is a work day on positions 0 and 1 of the cycle', () => {
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-01'))).toEqual({ startTime: '09:00', endTime: '17:00' })
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-02'))).toEqual({ startTime: '09:00', endTime: '17:00' })
    })

    it('is off on positions 2 and 3, then works again on the next cycle', () => {
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-03'))).toBeNull()
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-04'))).toBeNull()
      expect(availableWindowForDate(schedule, slots, new Date('2026-08-05'))).toEqual({ startTime: '09:00', endTime: '17:00' })
    })
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
