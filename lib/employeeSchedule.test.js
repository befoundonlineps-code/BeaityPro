import { defaultSlotsForPattern, slotsFromRows, validateSlots, validateCycleFields } from './employeeSchedule'

describe('defaultSlotsForPattern', () => {
  it('builds 7 weekly slots keyed 0-6', () => {
    const slots = defaultSlotsForPattern('weekly')
    expect(slots.map((s) => s.slotKey)).toEqual(['0', '1', '2', '3', '4', '5', '6'])
    expect(slots.every((s) => s.isActive && s.startTime === '09:00' && s.endTime === '18:00')).toBe(true)
  })

  it('builds 2 even_odd slots', () => {
    expect(defaultSlotsForPattern('even_odd').map((s) => s.slotKey)).toEqual(['even', 'odd'])
  })

  it('builds a single cycle slot', () => {
    expect(defaultSlotsForPattern('cycle').map((s) => s.slotKey)).toEqual(['work'])
  })
})

describe('slotsFromRows', () => {
  it('fills in saved values and defaults missing ones', () => {
    const rows = [
      { slot_key: '0', is_active: false, start_time: '10:00:00', end_time: '14:00:00' },
    ]
    const slots = slotsFromRows('weekly', rows)
    expect(slots[0]).toEqual({ slotKey: '0', isActive: false, startTime: '10:00', endTime: '14:00' })
    expect(slots[1]).toEqual({ slotKey: '1', isActive: true, startTime: '09:00', endTime: '18:00' })
  })

  it('tolerates no rows at all', () => {
    const slots = slotsFromRows('even_odd', [])
    expect(slots.map((s) => s.slotKey)).toEqual(['even', 'odd'])
  })
})

describe('validateSlots', () => {
  it('flags an active slot whose end time is not after its start time', () => {
    const errors = validateSlots([
      { slotKey: '0', isActive: true, startTime: '09:00', endTime: '09:00' },
      { slotKey: '1', isActive: true, startTime: '10:00', endTime: '09:00' },
      { slotKey: '2', isActive: true, startTime: '09:00', endTime: '18:00' },
    ])
    expect(Object.keys(errors)).toEqual(['0', '1'])
  })

  it('ignores inactive slots even if their times are invalid', () => {
    const errors = validateSlots([{ slotKey: '0', isActive: false, startTime: '09:00', endTime: '09:00' }])
    expect(errors).toEqual({})
  })
})

describe('validateCycleFields', () => {
  it('accepts a valid work/cycle pair', () => {
    expect(validateCycleFields(2, 4)).toBeNull()
  })

  it('rejects non-integer or non-positive values', () => {
    expect(validateCycleFields(0, 4)).toBe('workDaysInvalid')
    expect(validateCycleFields(2.5, 4)).toBe('workDaysInvalid')
    expect(validateCycleFields(2, 0)).toBe('cycleLengthInvalid')
  })

  it('rejects work days that are not fewer than the cycle length', () => {
    expect(validateCycleFields(4, 4)).toBe('workDaysExceedsCycle')
    expect(validateCycleFields(5, 4)).toBe('workDaysExceedsCycle')
  })
})
