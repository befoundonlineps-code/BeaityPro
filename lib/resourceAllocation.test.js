import {
  serviceUsesResources,
  orderedUnitsForService,
  freeUnits,
  conflictKind,
  occupiedUnitIds,
  availableUnitsFor,
} from './resourceAllocation'

const resources = [
  { id: 'room-b', sort_order: 2, created_at: '2026-01-02' },
  { id: 'room-a', sort_order: 1, created_at: '2026-01-01' },
  { id: 'unlinked', sort_order: 3, created_at: '2026-01-03' },
]

const units = [
  { id: 'a3', resource_id: 'room-a', unit_index: 3 },
  { id: 'a1', resource_id: 'room-a', unit_index: 1 },
  { id: 'a2', resource_id: 'room-a', unit_index: 2 },
  { id: 'b2', resource_id: 'room-b', unit_index: 2 },
  { id: 'b1', resource_id: 'room-b', unit_index: 1 },
  { id: 'u1', resource_id: 'unlinked', unit_index: 1 },
]

const serviceResources = [
  { service_id: 'facial', resource_id: 'room-a' },
  { service_id: 'facial', resource_id: 'room-b' },
  { service_id: 'massage', resource_id: 'room-b' },
]

describe('serviceUsesResources', () => {
  it('is true only for a service with at least one linked resource', () => {
    expect(serviceUsesResources('facial', serviceResources)).toBe(true)
    expect(serviceUsesResources('haircut', serviceResources)).toBe(false)
    expect(serviceUsesResources(null, serviceResources)).toBe(false)
  })
})

describe('orderedUnitsForService', () => {
  it('fills one resource fully before moving to the next', () => {
    const ordered = orderedUnitsForService('facial', serviceResources, resources, units)
    expect(ordered.map((u) => u.id)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
  })

  it('returns only the linked resource\'s units', () => {
    const ordered = orderedUnitsForService('massage', serviceResources, resources, units)
    expect(ordered.map((u) => u.id)).toEqual(['b1', 'b2'])
  })

  it('returns nothing for a service linked to no resource', () => {
    expect(orderedUnitsForService('haircut', serviceResources, resources, units)).toEqual([])
  })

  it('tolerates empty inputs', () => {
    expect(orderedUnitsForService('facial', null, null, null)).toEqual([])
  })
})

describe('freeUnits', () => {
  const ordered = orderedUnitsForService('facial', serviceResources, resources, units)

  it('drops the occupied units and keeps fill order', () => {
    const free = freeUnits(ordered, ['a1', 'b1'])
    expect(free.map((u) => u.id)).toEqual(['a2', 'a3', 'b2'])
  })

  it('counts every unit as free when nothing is occupied', () => {
    expect(freeUnits(ordered, []).length).toBe(5)
    expect(freeUnits(ordered, null).length).toBe(5)
  })

  it('returns none when every unit is taken', () => {
    expect(freeUnits(ordered, ['a1', 'a2', 'a3', 'b1', 'b2'])).toEqual([])
  })

  it('accepts a Set as well as an array', () => {
    expect(freeUnits(ordered, new Set(['a1'])).map((u) => u.id)).toEqual(['a2', 'a3', 'b1', 'b2'])
  })
})

// The exact staggered-booking case: a capacity-3 room where sessions start
// at different times, so units free up one by one rather than together.
describe('staggered bookings on a capacity-3 room', () => {
  const roomUnits = [
    { id: 'u1', resource_id: 'room', unit_index: 1 },
    { id: 'u2', resource_id: 'room', unit_index: 2 },
    { id: 'u3', resource_id: 'room', unit_index: 3 },
  ]
  const T = (hhmm) => new Date(`2026-08-10T${hhmm}:00`)
  const booked = (unit, from, to) => ({
    resource_unit_id: unit, status: 'booked', start_time: T(from).toISOString(), end_time: T(to).toISOString(),
  })

  // Employee A takes u1 at 2:00-2:40.
  const afterA = [booked('u1', '14:00', '14:40')]

  it('sends employee B (2:20) to unit 2, since unit 1 is mid-session', () => {
    const free = availableUnitsFor(roomUnits, afterA, T('14:20'), T('15:00'))
    expect(free.map((u) => u.id)).toEqual(['u2', 'u3'])
  })

  const afterB = [...afterA, booked('u2', '14:20', '15:00')]

  it('sends employee C (2:30) to unit 3, the only one left', () => {
    const free = availableUnitsFor(roomUnits, afterB, T('14:30'), T('15:10'))
    expect(free.map((u) => u.id)).toEqual(['u3'])
  })

  const afterC = [...afterB, booked('u3', '14:30', '15:10')]

  it('lets employee D book at 2:40 on unit 1, which just freed up', () => {
    const free = availableUnitsFor(roomUnits, afterC, T('14:40'), T('15:20'))
    expect(free.map((u) => u.id)).toEqual(['u1'])
    expect(free.length).toBeGreaterThan(0) // must NOT report the room full
  })

  it('still reports the room full at 2:35, when all three are mid-session', () => {
    const free = availableUnitsFor(roomUnits, afterC, T('14:35'), T('15:15'))
    expect(free).toEqual([])
  })

  it('frees every unit once the last session has ended', () => {
    const free = availableUnitsFor(roomUnits, afterC, T('15:10'), T('15:50'))
    expect(free.map((u) => u.id)).toEqual(['u1', 'u2', 'u3'])
  })
})

describe('occupiedUnitIds', () => {
  const T = (hhmm) => new Date(`2026-08-10T${hhmm}:00`)
  const row = (over) => ({
    resource_unit_id: 'u1', status: 'booked',
    start_time: T('14:00').toISOString(), end_time: T('14:40').toISOString(),
    ...over,
  })

  it('treats touching ranges as free, not occupied', () => {
    expect(occupiedUnitIds([row()], T('14:40'), T('15:20')).has('u1')).toBe(false)
    expect(occupiedUnitIds([row()], T('13:20'), T('14:00')).has('u1')).toBe(false)
  })

  it('counts a genuine overlap, even a one-minute one', () => {
    expect(occupiedUnitIds([row()], T('14:39'), T('15:20')).has('u1')).toBe(true)
  })

  it('ignores cancelled, no-show and waiting rows', () => {
    expect(occupiedUnitIds([row({ status: 'cancelled' })], T('14:00'), T('14:40')).size).toBe(0)
    expect(occupiedUnitIds([row({ status: 'no_show' })], T('14:00'), T('14:40')).size).toBe(0)
    expect(occupiedUnitIds([row({ status: 'waiting', start_time: null, end_time: null })], T('14:00'), T('14:40')).size).toBe(0)
  })

  it('ignores appointments not tied to any unit', () => {
    expect(occupiedUnitIds([row({ resource_unit_id: null })], T('14:00'), T('14:40')).size).toBe(0)
  })

  it('tolerates empty input', () => {
    expect(occupiedUnitIds(null, T('14:00'), T('14:40')).size).toBe(0)
  })
})

describe('conflictKind', () => {
  it('identifies a resource clash', () => {
    const e = { code: '23P01', message: 'conflicting key value violates exclusion constraint "appointments_resource_no_overlap"' }
    expect(conflictKind(e)).toBe('resource')
  })

  it('identifies an employee clash', () => {
    const e = { code: '23P01', message: 'conflicting key value violates exclusion constraint "appointments_no_overlap"' }
    expect(conflictKind(e)).toBe('employee')
  })

  it('reads the details field too', () => {
    const e = { code: '23P01', message: 'conflicting key value', details: 'constraint appointments_resource_no_overlap' }
    expect(conflictKind(e)).toBe('resource')
  })

  it('returns null for an unrelated error, and for none', () => {
    expect(conflictKind({ code: '23505', message: 'duplicate key' })).toBeNull()
    expect(conflictKind(null)).toBeNull()
  })
})
