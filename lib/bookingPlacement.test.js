import {
  resolvePlacementWindow,
  isServiceAllowedForRole,
  evaluatePlacement,
} from './bookingPlacement'

const D = (hhmm) => new Date(`2026-08-10T${hhmm}:00`)

const categories = [
  { id: 'cat-hair', salon_id: 's', parent_id: null, business_type: 'hairdressing', name: 'شعر' },
  { id: 'cat-nails', salon_id: 's', parent_id: null, business_type: 'nails', name: 'أظافر' },
  { id: 'cat-general', salon_id: 's', parent_id: null, business_type: null, name: 'عام' },
]

const services = [
  { id: 'svc-cut', category_id: 'cat-hair', duration_minutes: 60 },
  { id: 'svc-mani', category_id: 'cat-nails', duration_minutes: 30 },
  { id: 'svc-any', category_id: 'cat-general', duration_minutes: 45 },
]

const roleBusinessTypes = [
  { role: 'hairdresser', business_type: 'hairdressing' },
  { role: 'manicure_professional', business_type: 'nails' },
]

const byId = Object.fromEntries(services.map((s) => [s.id, s]))

describe('resolvePlacementWindow', () => {
  it('applies the service duration to a future start', () => {
    const w = resolvePlacementWindow(D('14:00'), byId['svc-cut'], D('09:00'))
    expect(w.start).toEqual(D('14:00'))
    expect(w.end).toEqual(D('15:00'))
  })

  it('refuses a slot that has already finished', () => {
    expect(resolvePlacementWindow(D('14:00'), byId['svc-cut'], D('14:35'))).toBeNull()
  })

  it('starts a slot already under way from now, keeping the full duration', () => {
    const now = new Date('2026-08-10T14:03:30')
    const w = resolvePlacementWindow(D('14:00'), byId['svc-cut'], now)
    expect(w.start).toEqual(D('14:04')) // rounded up, never behind now
    expect(w.end).toEqual(D('15:04'))   // 60 minutes preserved
  })

  it('returns null when there is nothing to place', () => {
    expect(resolvePlacementWindow(null, byId['svc-cut'], D('09:00'))).toBeNull()
    expect(resolvePlacementWindow(D('14:00'), null, D('09:00'))).toBeNull()
  })
})

describe('isServiceAllowedForRole', () => {
  const allowed = (role, serviceId) =>
    isServiceAllowedForRole(role, byId[serviceId], services, categories, roleBusinessTypes)

  it('allows a service its role covers', () => {
    expect(allowed('hairdresser', 'svc-cut')).toBe(true)
    expect(allowed('manicure_professional', 'svc-mani')).toBe(true)
  })

  it('refuses a service belonging to another business type', () => {
    expect(allowed('hairdresser', 'svc-mani')).toBe(false)
    expect(allowed('manicure_professional', 'svc-cut')).toBe(false)
  })

  it('allows a general service to every role, including admin ones', () => {
    expect(allowed('hairdresser', 'svc-any')).toBe(true)
    expect(allowed('administrator', 'svc-any')).toBe(true)
  })

  it('refuses when there is no role or no service to judge', () => {
    expect(allowed(null, 'svc-cut')).toBe(false)
    expect(isServiceAllowedForRole('hairdresser', null, services, categories, roleBusinessTypes)).toBe(false)
  })
})

describe('evaluatePlacement', () => {
  const windows = [{ startTime: '09:00', endTime: '17:00' }]
  const units = [
    { id: 'u1', resource_id: 'room', unit_index: 1 },
    { id: 'u2', resource_id: 'room', unit_index: 2 },
  ]
  const booked = (id, from, to, unit) => ({
    id, status: 'booked', start_time: D(from).toISOString(), end_time: D(to).toISOString(),
    resource_unit_id: unit || null,
  })

  const base = {
    start: D('10:00'),
    end: D('11:00'),
    windows,
    roleAllowed: true,
    employeeAppointments: [],
    orderedUnits: [],
    unitAppointments: [],
  }

  it('approves a clean slot inside the shift, claiming no unit', () => {
    const result = evaluatePlacement(base)
    expect(result).toEqual({ ok: true, outsideSchedule: false, candidateUnits: [null] })
  })

  it('refuses a role that cannot perform the service, before anything else', () => {
    // Deliberately also conflicting: the role answer must win, since no
    // amount of rescheduling makes a masseur able to do makeup.
    const result = evaluatePlacement({
      ...base,
      roleAllowed: false,
      employeeAppointments: [booked('other', '10:30', '11:30')],
    })
    expect(result).toEqual({ ok: false, reason: 'roleMismatch' })
  })

  it('refuses a slot somebody else already holds', () => {
    const result = evaluatePlacement({ ...base, employeeAppointments: [booked('other', '10:30', '11:30')] })
    expect(result).toEqual({ ok: false, reason: 'conflict' })
  })

  it('lets a booking be dragged onto a slot overlapping its own', () => {
    // The dragged booking is still sitting at 10:00-11:00 while this runs.
    // Without excludeAppointmentId it would be found conflicting with
    // itself, and every small nudge would be refused.
    const self = booked('being-moved', '10:00', '11:00')
    const result = evaluatePlacement({
      ...base,
      start: D('10:30'),
      end: D('11:30'),
      employeeAppointments: [self],
      excludeAppointmentId: 'being-moved',
    })
    expect(result.ok).toBe(true)
  })

  it('still catches a real conflict while dragging', () => {
    const result = evaluatePlacement({
      ...base,
      start: D('10:30'),
      end: D('11:30'),
      employeeAppointments: [booked('being-moved', '10:00', '11:00'), booked('someone-else', '11:00', '12:00')],
      excludeAppointmentId: 'being-moved',
    })
    expect(result).toEqual({ ok: false, reason: 'conflict' })
  })

  it('reports a slot outside the shift as a question, not a refusal', () => {
    const result = evaluatePlacement({ ...base, start: D('18:00'), end: D('19:00') })
    expect(result.ok).toBe(true)
    expect(result.outsideSchedule).toBe(true)
  })

  it('treats an employee with no shift at all as outside it', () => {
    const result = evaluatePlacement({ ...base, windows: [] })
    expect(result.ok).toBe(true)
    expect(result.outsideSchedule).toBe(true)
  })

  it('offers free units in fill order for a resource-backed service', () => {
    const result = evaluatePlacement({ ...base, orderedUnits: units })
    expect(result.candidateUnits.map((u) => u.id)).toEqual(['u1', 'u2'])
  })

  it('drops a unit busy during the window', () => {
    const result = evaluatePlacement({
      ...base,
      orderedUnits: units,
      unitAppointments: [booked('x', '10:30', '11:30', 'u1')],
    })
    expect(result.candidateUnits.map((u) => u.id)).toEqual(['u2'])
  })

  it('refuses once every unit is taken', () => {
    const result = evaluatePlacement({
      ...base,
      orderedUnits: units,
      unitAppointments: [booked('x', '10:00', '11:00', 'u1'), booked('y', '10:00', '11:00', 'u2')],
    })
    expect(result).toEqual({ ok: false, reason: 'resourcesBusy' })
  })

  it('frees a unit whose booking merely touches the window', () => {
    const result = evaluatePlacement({
      ...base,
      orderedUnits: units,
      unitAppointments: [booked('x', '09:00', '10:00', 'u1')],
    })
    expect(result.candidateUnits.map((u) => u.id)).toEqual(['u1', 'u2'])
  })

  it('answers the resource question before the shift one is even asked', () => {
    // A full room outside hours is refused outright — there is nothing to
    // ask the receptionist, since agreeing to stay late would not conjure
    // up a free bed.
    const result = evaluatePlacement({
      ...base,
      start: D('18:00'),
      end: D('19:00'),
      orderedUnits: units,
      unitAppointments: [booked('x', '18:00', '19:00', 'u1'), booked('y', '18:00', '19:00', 'u2')],
    })
    expect(result).toEqual({ ok: false, reason: 'resourcesBusy' })
  })
})
