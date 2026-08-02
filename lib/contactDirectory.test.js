import {
  buildDirectory,
  onShiftEntries,
  contactEntries,
  matchesQuery,
  SOURCE_EMPLOYEE,
  SOURCE_CONTACT,
} from './contactDirectory'

const EMPLOYEES = [
  { id: 'e1', name: 'لينا', role: 'hairdresser', phone_number: '059-123-4567' },
  { id: 'e2', name: 'نسرين', role: 'masseur', phone_number: null },
  { id: 'e3', name: 'رنا', role: 'stylist', phone_number: '0598887766' },
]

// Only e1 and e2 have a window today.
const WINDOWS = {
  e1: [{ startTime: '09:00', endTime: '17:00' }],
  e2: [{ startTime: '10:00', endTime: '15:00' }],
  e3: [],
}

const CONTACTS = [
  { id: 'c1', name: 'صاحب الصالون', phone_number: '0561112222' },
]

const names = (rows) => rows.map((r) => r.name)

describe('onShiftEntries', () => {
  it('keeps only professionals with a window today', () => {
    // e3 has none — off, or absent, or simply not scheduled. All three arrive
    // here as an empty list, which is the point of reading the windows.
    expect(names(onShiftEntries(EMPLOYEES, WINDOWS))).toEqual(['لينا', 'نسرين'])
  })

  it('marks the source and carries the phone through, null included', () => {
    const rows = onShiftEntries(EMPLOYEES, WINDOWS)
    expect(rows[0]).toMatchObject({ source: SOURCE_EMPLOYEE, phone: '059-123-4567', role: 'hairdresser' })
    expect(rows[1].phone).toBe(null)
  })

  it('copes with nothing at all', () => {
    expect(onShiftEntries(null, null)).toEqual([])
    expect(onShiftEntries(EMPLOYEES, {})).toEqual([])
  })
})

describe('contactEntries', () => {
  it('carries a fixed contact across with no role', () => {
    expect(contactEntries(CONTACTS)[0]).toMatchObject({
      source: SOURCE_CONTACT, name: 'صاحب الصالون', phone: '0561112222', role: null,
    })
  })

  it('copes with nothing', () => {
    expect(contactEntries(null)).toEqual([])
  })
})

describe('matchesQuery', () => {
  const entry = { name: 'لينا', phone: '059-123-4567' }

  it('keeps everything when nothing is typed', () => {
    expect(matchesQuery(entry, '')).toBe(true)
    expect(matchesQuery(entry, '   ')).toBe(true)
    expect(matchesQuery(entry, null)).toBe(true)
  })

  it('matches part of a name', () => {
    expect(matchesQuery(entry, 'لين')).toBe(true)
    expect(matchesQuery(entry, 'رنا')).toBe(false)
  })

  it('matches a number typed without its punctuation', () => {
    // Saved as 059-123-4567, typed as 0591234567 — which is how anybody
    // actually types a phone number.
    expect(matchesQuery(entry, '0591234567')).toBe(true)
    expect(matchesQuery(entry, '1234')).toBe(true)
  })

  it('matches a number typed with different punctuation', () => {
    expect(matchesQuery(entry, '059 123')).toBe(true)
  })

  it('does not match a number nobody has', () => {
    expect(matchesQuery(entry, '0777')).toBe(false)
  })

  it('never matches a digit query against somebody with no number', () => {
    expect(matchesQuery({ name: 'نسرين', phone: null }, '059')).toBe(false)
  })

  it('is case-insensitive on latin names', () => {
    expect(matchesQuery({ name: 'Lina', phone: null }, 'lina')).toBe(true)
  })
})

describe('buildDirectory', () => {
  const build = (query) => buildDirectory({ employees: EMPLOYEES, windowsByEmployee: WINDOWS, contacts: CONTACTS, query })

  it('puts the people working today ahead of the fixed contacts', () => {
    // The panel exists for the day in progress: the owner's number does not
    // change, the roster does.
    expect(names(build(''))).toEqual(['لينا', 'نسرين', 'صاحب الصالون'])
  })

  it('searches across both sources at once', () => {
    expect(names(build('صاحب'))).toEqual(['صاحب الصالون'])
    expect(names(build('نسرين'))).toEqual(['نسرين'])
  })

  it('finds a fixed contact by number too', () => {
    expect(names(build('0561112222'))).toEqual(['صاحب الصالون'])
  })

  it('returns nothing rather than everything when nothing matches', () => {
    expect(build('لا أحد')).toEqual([])
  })

  it('copes with no data at all', () => {
    expect(buildDirectory({})).toEqual([])
  })
})
