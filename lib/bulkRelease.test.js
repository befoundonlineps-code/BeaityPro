import {
  classifyBulkRelease,
  matchesTarget,
  releaseWindow,
  startsAfter,
  RELEASABLE_STATUSES,
} from './bulkRelease'

const CUTOFF = new Date('2026-08-01T10:00:00')

function booking(overrides) {
  return {
    id: 'a1',
    status: 'booked',
    is_primary: true,
    employee_id: 'emp-1',
    resource_unit_id: null,
    start_time: '2026-08-01T14:00:00',
    ...overrides,
  }
}

const EMPLOYEE = { kind: 'employee', employeeId: 'emp-1' }

describe('startsAfter', () => {
  it('keeps anything that has not started yet', () => {
    expect(startsAfter(booking({ start_time: '2026-08-01T10:30:00' }), CUTOFF)).toBe(true)
    expect(startsAfter(booking({ start_time: '2026-08-03T09:00:00' }), CUTOFF)).toBe(true)
  })

  it('drops anything already under way or finished', () => {
    // The row may say `booked` only because nobody marked it completed.
    // Cancelling it would rewrite a session that actually happened.
    expect(startsAfter(booking({ start_time: '2026-08-01T09:00:00' }), CUTOFF)).toBe(false)
  })

  it('treats a booking starting exactly at the cutoff as still ahead', () => {
    expect(startsAfter(booking({ start_time: '2026-08-01T10:00:00' }), CUTOFF)).toBe(true)
  })

  it('says no for a waiting entry, which has no start_time at all', () => {
    expect(startsAfter(booking({ start_time: null, status: 'waiting' }), CUTOFF)).toBe(false)
  })

  it('says no rather than throwing when there is no row', () => {
    expect(startsAfter(null, CUTOFF)).toBe(false)
  })
})

describe('matchesTarget', () => {
  it('matches an employee by their own row', () => {
    expect(matchesTarget(booking({ employee_id: 'emp-1' }), EMPLOYEE)).toBe(true)
    expect(matchesTarget(booking({ employee_id: 'emp-2' }), EMPLOYEE)).toBe(false)
  })

  it('matches a resource by the unit the booking holds', () => {
    const target = { kind: 'resourceUnits', unitIds: ['unit-2'] }
    expect(matchesTarget(booking({ resource_unit_id: 'unit-2' }), target)).toBe(true)
    expect(matchesTarget(booking({ resource_unit_id: 'unit-1' }), target)).toBe(false)
  })

  it('covers a whole resource by listing every one of its units', () => {
    // "The whole resource" is not a second mode — one broken machine is one
    // unit id, the whole resource is all of them, and the path is the same.
    const target = { kind: 'resourceUnits', unitIds: ['unit-1', 'unit-2', 'unit-3'] }
    expect(matchesTarget(booking({ resource_unit_id: 'unit-3' }), target)).toBe(true)
  })

  it('never matches a booking holding no unit against a resource target', () => {
    const target = { kind: 'resourceUnits', unitIds: ['unit-1'] }
    expect(matchesTarget(booking({ resource_unit_id: null }), target)).toBe(false)
  })

  it('says no rather than throwing on missing input', () => {
    expect(matchesTarget(null, EMPLOYEE)).toBe(false)
    expect(matchesTarget(booking(), null)).toBe(false)
    expect(matchesTarget(booking(), { kind: 'nonsense' })).toBe(false)
    expect(matchesTarget(booking(), { kind: 'employee', employeeId: null })).toBe(false)
  })
})

describe('releaseWindow', () => {
  it('covers the whole of a single chosen day', () => {
    const { from, to } = releaseWindow('2026-08-01', '2026-08-01')
    expect(from).toEqual(new Date('2026-08-01T00:00:00'))
    // Exclusive: a booking at 23:30 on the 1st is inside, one at 00:00 on
    // the 2nd is not.
    expect(to).toEqual(new Date('2026-08-02T00:00:00'))
  })

  it('runs to the end of the last day of a range', () => {
    const { to } = releaseWindow('2026-08-01', '2026-08-03')
    expect(to).toEqual(new Date('2026-08-04T00:00:00'))
  })

  it('crosses a month boundary without arithmetic of its own', () => {
    const { to } = releaseWindow('2026-08-30', '2026-08-31')
    expect(to).toEqual(new Date('2026-09-01T00:00:00'))
  })

  it('refuses a range that runs backwards', () => {
    // Reported to the receptionist rather than quietly releasing nothing.
    expect(releaseWindow('2026-08-03', '2026-08-01')).toBe(null)
  })

  it('refuses missing or unparseable dates', () => {
    expect(releaseWindow('', '2026-08-01')).toBe(null)
    expect(releaseWindow('2026-08-01', '')).toBe(null)
    expect(releaseWindow('not-a-date', '2026-08-01')).toBe(null)
  })
})

describe('classifyBulkRelease', () => {
  it('sends a primary to cancellation and a participant to removal', () => {
    // The decided rule: losing the main professional moves the client to the
    // queue, losing an extra pair of hands does not — that session carries on.
    const rows = [
      booking({ id: 'primary', is_primary: true }),
      booking({ id: 'participant', is_primary: false }),
    ]
    const { toCancel, toRemove } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel.map((r) => r.id)).toEqual(['primary'])
    expect(toRemove.map((r) => r.id)).toEqual(['participant'])
  })

  it('takes only the two live states', () => {
    const rows = ['completed', 'cancelled', 'no_show', 'rescheduled', 'adjusted', 'waiting'].map(
      (status, i) => booking({ id: `x${i}`, status })
    )
    const { toCancel, toRemove } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel).toEqual([])
    expect(toRemove).toEqual([])
  })

  it('takes both live states', () => {
    const rows = RELEASABLE_STATUSES.map((status, i) => booking({ id: `live${i}`, status }))
    const { toCancel } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel).toHaveLength(2)
  })

  it('leaves the past alone even when everything else matches', () => {
    const rows = [
      booking({ id: 'morning', start_time: '2026-08-01T09:00:00' }),
      booking({ id: 'afternoon', start_time: '2026-08-01T15:00:00' }),
    ]
    const { toCancel } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel.map((r) => r.id)).toEqual(['afternoon'])
  })

  it('ignores another employee entirely', () => {
    const rows = [booking({ id: 'theirs', employee_id: 'emp-9' })]
    const { toCancel, toRemove } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel).toEqual([])
    expect(toRemove).toEqual([])
  })

  it('never produces a removal for a resource target', () => {
    // appointments_group_resource_check keeps resource_unit_id on the primary
    // row only, so a broken unit can never match a participant.
    const rows = [
      booking({ id: 'holder', is_primary: true, resource_unit_id: 'unit-1' }),
      booking({ id: 'helper', is_primary: false, resource_unit_id: null }),
    ]
    const { toCancel, toRemove } = classifyBulkRelease({
      appointments: rows,
      target: { kind: 'resourceUnits', unitIds: ['unit-1'] },
      cutoff: CUTOFF,
    })
    expect(toCancel.map((r) => r.id)).toEqual(['holder'])
    expect(toRemove).toEqual([])
  })

  it('orders the preview earliest first across several days', () => {
    const rows = [
      booking({ id: 'later', start_time: '2026-08-02T09:00:00' }),
      booking({ id: 'sooner', start_time: '2026-08-01T16:00:00' }),
      booking({ id: 'soonest', start_time: '2026-08-01T11:00:00' }),
    ]
    const { toCancel } = classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(toCancel.map((r) => r.id)).toEqual(['soonest', 'sooner', 'later'])
  })

  it('leaves the caller array untouched', () => {
    const rows = [
      booking({ id: 'later', start_time: '2026-08-02T09:00:00' }),
      booking({ id: 'sooner', start_time: '2026-08-01T16:00:00' }),
    ]
    classifyBulkRelease({ appointments: rows, target: EMPLOYEE, cutoff: CUTOFF })
    expect(rows.map((r) => r.id)).toEqual(['later', 'sooner'])
  })

  it('copes with nothing at all', () => {
    expect(classifyBulkRelease({ appointments: null, target: EMPLOYEE, cutoff: CUTOFF })).toEqual({
      toCancel: [],
      toRemove: [],
    })
  })
})
