import { initialsFromName, getInitials, getAvatarColor } from './avatarColor'

describe('initialsFromName', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFromName('لينا ناطور')).toBe('لن')
    expect(initialsFromName('Sara Ahmed')).toBe('SA')
  })

  it('takes one letter when there is only one word', () => {
    expect(initialsFromName('لينا')).toBe('ل')
    expect(initialsFromName('Omar')).toBe('O')
  })

  it('ignores anything past the second word', () => {
    // A 24px circle holds two letters and no more.
    expect(initialsFromName('عبد الرحمن محمود سعيد')).toBe('عا')
  })

  it('copes with extra whitespace', () => {
    expect(initialsFromName('  Sara   Ahmed  ')).toBe('SA')
  })

  it('falls back rather than rendering an empty circle', () => {
    expect(initialsFromName('')).toBe('?')
    expect(initialsFromName(null)).toBe('?')
    expect(initialsFromName('   ')).toBe('?')
  })
})

describe('getInitials', () => {
  it('still works on a first/last pair', () => {
    expect(getInitials('Sara', 'Ahmed')).toBe('SA')
    expect(getInitials('Sara', null)).toBe('S')
    expect(getInitials(null, null)).toBe('?')
  })
})

describe('getAvatarColor', () => {
  it('gives the same seed the same colour every time', () => {
    expect(getAvatarColor('emp-1')).toBe(getAvatarColor('emp-1'))
  })

  it('gives different seeds different colours, usually', () => {
    const colours = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(getAvatarColor))
    expect(colours.size).toBeGreaterThan(1)
  })

  it('always returns a colour, even for nothing', () => {
    expect(getAvatarColor(null)).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})
