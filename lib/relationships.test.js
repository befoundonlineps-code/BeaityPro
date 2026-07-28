import { getRelationshipLabel, getOtherClientId } from './relationships'

const FIXTURE_LABELS = {
  'relationshipLabels.spouse.male': 'زوج',
  'relationshipLabels.spouse.female': 'زوجة',
  'relationshipLabels.child.female': 'ابنة',
  'relationshipLabels.parent.male': 'الأب',
  'relationshipLabels.friend.female': 'صديقة',
  'relationshipLabels.friend.male': 'صديق',
}
const t = (key) => FIXTURE_LABELS[key] || key

describe('getRelationshipLabel', () => {
  it('shows the gender-matched label for symmetric relationships (spouse)', () => {
    const row = { client_id: 'ahmad', related_client_id: 'sara', relationship_type: 'spouse' }
    // On Sara's profile, the "other" client is Ahmad (male) -> her husband
    expect(getRelationshipLabel(row, 'sara', 'male', t)).toBe('زوج')
    // On Ahmad's profile, the "other" client is Sara (female) -> his wife
    expect(getRelationshipLabel(row, 'ahmad', 'female', t)).toBe('زوجة')
  })

  it('flips child <-> parent depending on which side is being viewed', () => {
    // Ahmad added Sara as his daughter: client_id=ahmad (parent), related_client_id=sara (child)
    const row = { client_id: 'ahmad', related_client_id: 'sara', relationship_type: 'child' }
    // On Ahmad's profile, the other client is Sara (female) -> daughter
    expect(getRelationshipLabel(row, 'ahmad', 'female', t)).toBe('ابنة')
    // On Sara's profile, the other client is Ahmad (male) -> father
    expect(getRelationshipLabel(row, 'sara', 'male', t)).toBe('الأب')
  })

  it('uses the same label both ways for friend/colleague', () => {
    const row = { client_id: 'a', related_client_id: 'b', relationship_type: 'friend' }
    expect(getRelationshipLabel(row, 'a', 'female', t)).toBe('صديقة')
    expect(getRelationshipLabel(row, 'b', 'male', t)).toBe('صديق')
  })
})

describe('getOtherClientId', () => {
  it('returns whichever side of the row is not "me"', () => {
    const row = { client_id: 'a', related_client_id: 'b', relationship_type: 'friend' }
    expect(getOtherClientId(row, 'a')).toBe('b')
    expect(getOtherClientId(row, 'b')).toBe('a')
  })
})
