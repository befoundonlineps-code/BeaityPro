import { dbErrorKey, isUnexpectedDbError, reportDbError } from './dbErrors'

describe('dbErrorKey', () => {
  it('names the outcomes a receptionist can respond to', () => {
    expect(dbErrorKey({ code: '23505' })).toBe('common:dbError.duplicate')
    expect(dbErrorKey({ code: '23503' })).toBe('common:dbError.stillInUse')
    expect(dbErrorKey({ code: '23P01' })).toBe('common:dbError.slotTaken')
    expect(dbErrorKey({ code: '42501' })).toBe('common:dbError.notPermitted')
  })

  it('falls back to a plain sentence for anything unrecognised', () => {
    // The exact failure that leaked to the UI: a type mismatch inside a
    // function. Nothing a receptionist can act on, so it must never be
    // shown verbatim.
    expect(dbErrorKey({
      code: '42804',
      message: 'column "status" is of type appointment_status but expression is of type text',
    })).toBe('common:dbError.unexpected')

    expect(dbErrorKey({ message: 'some network blip' })).toBe('common:dbError.unexpected')
  })

  it('returns nothing when there is no error at all', () => {
    expect(dbErrorKey(null)).toBeNull()
    expect(dbErrorKey(undefined)).toBeNull()
  })
})

describe('isUnexpectedDbError', () => {
  it('flags only what nobody has decided how to explain yet', () => {
    expect(isUnexpectedDbError({ code: '42804' })).toBe(true)
    expect(isUnexpectedDbError({ code: '23505' })).toBe(false)
    expect(isUnexpectedDbError(null)).toBe(false)
  })
})

describe('reportDbError', () => {
  let spy
  beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { spy.mockRestore() })

  it('records an unrecognised error rather than losing it', () => {
    // Translating without recording would trade a bad message for a worse
    // outcome: the receptionist stops seeing noise, and whoever has to fix
    // the cause is left with nothing at all.
    const key = reportDbError({
      code: '42804',
      message: 'column "status" is of type appointment_status but expression is of type text',
    }, 'convertWaitingAppointment')

    expect(key).toBe('common:dbError.unexpected')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain('convertWaitingAppointment')
    expect(spy.mock.calls[0][1]).toMatchObject({ code: '42804' })
  })

  it('stays quiet for an outcome already explained to the user', () => {
    expect(reportDbError({ code: '23P01' }, 'createBooking')).toBe('common:dbError.slotTaken')
    expect(spy).not.toHaveBeenCalled()
  })

  it('stays quiet when there is no error', () => {
    expect(reportDbError(null, 'anything')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})
