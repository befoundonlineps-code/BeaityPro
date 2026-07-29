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
  ceilToMinute,
  slotEndContaining,
  isSlotPast,
  resolveBookingStart,
} from './appointmentGrid'
import { isWithinWindow } from './employeeAvailability'

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

const D = (hhmmss) => new Date(`2026-08-10T${hhmmss}`)

describe('ceilToMinute', () => {
  it('rounds a part-way minute up, never down', () => {
    expect(ceilToMinute(D('16:20:37.482'))).toEqual(D('16:21:00.000'))
  })

  it('leaves an exact minute untouched', () => {
    expect(ceilToMinute(D('16:20:00.000'))).toEqual(D('16:20:00.000'))
  })

  it('rolls into the next hour at the boundary', () => {
    expect(ceilToMinute(D('16:59:01'))).toEqual(D('17:00:00.000'))
  })
})

describe('slotEndContaining', () => {
  it('finds the end of the half-hour a time sits in', () => {
    expect(slotEndContaining(D('16:00:00'))).toEqual(D('16:30:00.000'))
    expect(slotEndContaining(D('16:10:00'))).toEqual(D('16:30:00.000'))
    expect(slotEndContaining(D('16:29:59'))).toEqual(D('16:30:00.000'))
  })

  it('rolls into the next hour for the second half', () => {
    expect(slotEndContaining(D('16:30:00'))).toEqual(D('17:00:00.000'))
    expect(slotEndContaining(D('16:45:00'))).toEqual(D('17:00:00.000'))
  })
})

describe('isSlotPast', () => {
  it('closes a slot only once it has fully finished', () => {
    expect(isSlotPast(D('16:00:00'), D('16:20:00'))).toBe(true)
    expect(isSlotPast(D('16:30:00'), D('16:20:00'))).toBe(false)
    expect(isSlotPast(D('16:20:00'), D('16:20:00'))).toBe(true)
  })
})

describe('resolveBookingStart', () => {
  const now = D('16:20:00')

  it('refuses a slot that has already finished', () => {
    expect(resolveBookingStart(D('15:30:00'), now)).toBeNull()
    expect(resolveBookingStart(D('09:00:00'), now)).toBeNull()
  })

  it('clamps a still-running slot to the current moment', () => {
    expect(resolveBookingStart(D('16:00:00'), now)).toEqual(D('16:20:00.000'))
    expect(resolveBookingStart(D('16:10:00'), now)).toEqual(D('16:20:00.000'))
  })

  it('leaves a future time exactly as requested', () => {
    expect(resolveBookingStart(D('16:25:00'), now)).toEqual(D('16:25:00'))
    expect(resolveBookingStart(D('18:00:00'), now)).toEqual(D('18:00:00'))
  })

  it('clamps to a whole minute, never behind now', () => {
    const start = resolveBookingStart(D('16:00:00'), D('16:20:37.482'))
    expect(start).toEqual(D('16:21:00.000'))
    expect(start.getTime()).toBeGreaterThan(D('16:20:37.482').getTime())
  })
})

// The two cases called out for this feature.
describe('clamping happens before the other checks', () => {
  it('rejects a service that no longer fits before closing once clamped', () => {
    // Employee works until 18:00. The 17:30 slot is clicked at 17:50, and the
    // service runs 40 minutes: from 17:50 that ends at 18:30, past closing.
    const now = D('17:50:00')
    const start = resolveBookingStart(D('17:30:00'), now)
    expect(start).toEqual(D('17:50:00.000'))

    const end = new Date(start.getTime() + 40 * 60000)
    const label = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(label(end)).toBe('18:30')

    const window = { startTime: '09:00', endTime: '18:00' }
    expect(isWithinWindow(window, label(start), label(end))).toBe(false)

    // Checking the untouched slot boundary instead would have wrongly passed.
    expect(isWithinWindow(window, '17:30', '18:10')).toBe(false)
    expect(isWithinWindow(window, '17:00', '17:40')).toBe(true)
  })

  it('still fits when the clamped service ends exactly at closing', () => {
    const now = D('17:20:00')
    const start = resolveBookingStart(D('17:00:00'), now)
    const end = new Date(start.getTime() + 40 * 60000)
    const label = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    expect(label(start)).toBe('17:20')
    expect(label(end)).toBe('18:00')
    expect(isWithinWindow({ startTime: '09:00', endTime: '18:00' }, label(start), label(end))).toBe(true)
  })
})

describe('re-clamping at the moment of saving', () => {
  it('moves the start forward when the dialog sat open for a while', () => {
    // Opened at 16:20 on the 16:00 slot, saved three minutes later.
    const atOpen = resolveBookingStart(D('16:00:00'), D('16:20:00'))
    expect(atOpen).toEqual(D('16:20:00.000'))

    const atSave = resolveBookingStart(atOpen, D('16:23:00'))
    expect(atSave).toEqual(D('16:23:00.000'))
  })

  it('refuses if the slot finished while the dialog was open', () => {
    const atOpen = resolveBookingStart(D('16:00:00'), D('16:20:00'))
    expect(resolveBookingStart(atOpen, D('16:31:00'))).toBeNull()
  })

  it('leaves a future booking alone no matter how long the dialog was open', () => {
    const atOpen = resolveBookingStart(D('18:00:00'), D('16:20:00'))
    expect(resolveBookingStart(atOpen, D('16:35:00'))).toEqual(D('18:00:00'))
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
