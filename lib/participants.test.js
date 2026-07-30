import { canRemoveParticipant, sortPrimaryFirst } from './participants'

describe('canRemoveParticipant', () => {
  it('offers removal for a participant who is still on the session', () => {
    expect(canRemoveParticipant({ is_primary: false, status: 'booked' })).toBe(true)
    expect(canRemoveParticipant({ is_primary: false, status: 'pending_approval' })).toBe(true)
  })

  it('never offers it for the primary', () => {
    // Removing the primary would be cancelling the session, which propagates
    // to everyone and asks for its own reason. remove_participant refuses it
    // outright, so the button must not appear either.
    expect(canRemoveParticipant({ is_primary: true, status: 'booked' })).toBe(false)
    expect(canRemoveParticipant({ is_primary: true, status: 'pending_approval' })).toBe(false)
  })

  it('never offers it once the row has moved on', () => {
    for (const status of ['cancelled', 'completed', 'no_show', 'rescheduled', 'adjusted', 'waiting']) {
      expect(canRemoveParticipant({ is_primary: false, status })).toBe(false)
    }
  })

  it('says no rather than throwing when there is no row', () => {
    expect(canRemoveParticipant(null)).toBe(false)
    expect(canRemoveParticipant(undefined)).toBe(false)
  })
})

describe('sortPrimaryFirst', () => {
  it('puts the primary at the top whichever order they arrive in', () => {
    const rows = [
      { id: 'b', is_primary: false },
      { id: 'a', is_primary: true },
      { id: 'c', is_primary: false },
    ]
    expect(sortPrimaryFirst(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('leaves the original array untouched', () => {
    const rows = [{ id: 'b', is_primary: false }, { id: 'a', is_primary: true }]
    sortPrimaryFirst(rows)
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('copes with nothing at all', () => {
    expect(sortPrimaryFirst(null)).toEqual([])
    expect(sortPrimaryFirst([])).toEqual([])
  })
})
