import { getRelationshipLabel, getOtherClientId } from './relationships'

describe('getRelationshipLabel', () => {
  it('shows the gender-matched label for symmetric relationships (spouse)', () => {
    const row = { client_id: 'ahmad', related_client_id: 'sara', relationship_type: 'spouse' }
    // On Sara's profile, the "other" client is Ahmad (male) -> her husband
    expect(getRelationshipLabel(row, 'sara', 'male')).toBe('زوج')
    // On Ahmad's profile, the "other" client is Sara (female) -> his wife
    expect(getRelationshipLabel(row, 'ahmad', 'female')).toBe('زوجة')
  })

  it('flips child <-> parent depending on which side is being viewed', () => {
    // Ahmad added Sara as his daughter: client_id=ahmad (parent), related_client_id=sara (child)
    const row = { client_id: 'ahmad', related_client_id: 'sara', relationship_type: 'child' }
    // On Ahmad's profile, the other client is Sara (female) -> daughter
    expect(getRelationshipLabel(row, 'ahmad', 'female')).toBe('ابنة')
    // On Sara's profile, the other client is Ahmad (male) -> father
    expect(getRelationshipLabel(row, 'sara', 'male')).toBe('الأب')
  })

  it('uses the same label both ways for friend/colleague', () => {
    const row = { client_id: 'a', related_client_id: 'b', relationship_type: 'friend' }
    expect(getRelationshipLabel(row, 'a', 'female')).toBe('صديقة')
    expect(getRelationshipLabel(row, 'b', 'male')).toBe('صديق')
  })
})

describe('getOtherClientId', () => {
  it('returns whichever side of the row is not "me"', () => {
    const row = { client_id: 'a', related_client_id: 'b', relationship_type: 'friend' }
    expect(getOtherClientId(row, 'a')).toBe('b')
    expect(getOtherClientId(row, 'b')).toBe('a')
  })
})
