import { serviceUsesResources, orderedUnitsForService, freeUnits, conflictKind } from './resourceAllocation'

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
