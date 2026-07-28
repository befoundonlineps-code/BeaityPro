import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_MINUTES,
  totalGridMinutes,
  buildTimeSlots,
  slotStartTime,
  minutesFromGridStart,
  isWithinGrid,
  rangesOverlap,
  hasConflict,
} from './appointmentGrid'

describe('buildTimeSlots', () => {
  it('builds one slot per interval from start to end hour', () => {
    const slots = buildTimeSlots()
    const expectedCount = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES
    expect(slots).toHaveLength(expectedCount)
    expect(slots[0]).toEqual({ minutesFromStart: 0, label: '08:00' })
    expect(slots[1]).toEqual({ minutesFromStart: 30, label: '08:30' })
    expect(slots[slots.length - 1].label).toBe('21:30')
  })
})

describe('slotStartTime / minutesFromGridStart', () => {
  it('round-trips a slot offset back to the same minutes', () => {
    const date = slotStartTime('2026-07-28', 90)
    expect(date.getHours()).toBe(9)
    expect(date.getMinutes()).toBe(30)
    expect(minutesFromGridStart(date)).toBe(90)
  })

  it('flags times outside the grid', () => {
    expect(isWithinGrid(-30)).toBe(false)
    expect(isWithinGrid(0)).toBe(true)
    expect(isWithinGrid(totalGridMinutes())).toBe(true)
    expect(isWithinGrid(totalGridMinutes() + 1)).toBe(false)
  })
})

describe('rangesOverlap', () => {
  it('detects overlap and touching ranges as non-overlapping', () => {
    expect(rangesOverlap(0, 60, 30, 90)).toBe(true)
    expect(rangesOverlap(0, 60, 60, 120)).toBe(false)
    expect(rangesOverlap(60, 120, 0, 60)).toBe(false)
  })
})

describe('hasConflict', () => {
  const existing = [
    { id: 'a1', status: 'booked', start_time: '2026-07-28T09:00:00', end_time: '2026-07-28T10:00:00' },
    { id: 'a2', status: 'cancelled', start_time: '2026-07-28T10:00:00', end_time: '2026-07-28T11:00:00' },
    { id: 'a3', status: 'waiting', start_time: null, end_time: null },
  ]

  it('flags a candidate overlapping a booked appointment', () => {
    const start = new Date('2026-07-28T09:30:00')
    const end = new Date('2026-07-28T10:30:00')
    expect(hasConflict(start, end, existing)).toBe(true)
  })

  it('ignores cancelled and waiting rows', () => {
    const start = new Date('2026-07-28T10:00:00')
    const end = new Date('2026-07-28T11:00:00')
    expect(hasConflict(start, end, existing)).toBe(false)
  })

  it('does not conflict with itself when editing (excludeId)', () => {
    const start = new Date('2026-07-28T09:00:00')
    const end = new Date('2026-07-28T10:00:00')
    expect(hasConflict(start, end, existing, 'a1')).toBe(false)
  })

  it('allows back-to-back appointments with no gap', () => {
    const start = new Date('2026-07-28T10:00:00')
    const end = new Date('2026-07-28T11:00:00')
    const backToBack = [{ id: 'b1', status: 'booked', start_time: '2026-07-28T09:00:00', end_time: '2026-07-28T10:00:00' }]
    expect(hasConflict(start, end, backToBack)).toBe(false)
  })
})
