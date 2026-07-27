import { getDuplicateWarningMessage } from './duplicateCheck'

describe('getDuplicateWarningMessage', () => {
  it('returns null when no client has this phone number', () => {
    expect(getDuplicateWarningMessage([])).toBeNull()
    expect(getDuplicateWarningMessage(null)).toBeNull()
  })

  it('returns the existing client\'s name when the phone number is already used', () => {
    const matches = [{ first_name: 'سارة', last_name: 'أحمد' }]
    expect(getDuplicateWarningMessage(matches)).toBe('سارة أحمد')
  })
})
