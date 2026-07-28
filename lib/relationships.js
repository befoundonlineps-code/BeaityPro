export const RELATIONSHIP_TYPE_VALUES = ['spouse', 'child', 'friend', 'colleague']

const SYMMETRIC_KEYS = {
  spouse: { male: 'relationshipLabels.spouse.male', female: 'relationshipLabels.spouse.female', other: 'relationshipLabels.spouse.other' },
  friend: { male: 'relationshipLabels.friend.male', female: 'relationshipLabels.friend.female', other: 'relationshipLabels.friend.other' },
  colleague: { male: 'relationshipLabels.colleague.male', female: 'relationshipLabels.colleague.female', other: 'relationshipLabels.colleague.other' },
}

const CHILD_KEY = { male: 'relationshipLabels.child.male', female: 'relationshipLabels.child.female', other: 'relationshipLabels.child.other' }
const PARENT_KEY = { male: 'relationshipLabels.parent.male', female: 'relationshipLabels.parent.female', other: 'relationshipLabels.parent.other' }

function byGender(map, gender) {
  return map[gender] || map.other
}

// row: { client_id, related_client_id, relationship_type }
// meId: the profile currently being viewed
// otherGender: the gender ('male' | 'female' | other) of the OTHER client in the row
// t: translation function (key) => translated string
export function getRelationshipLabel(row, meId, otherGender, t) {
  if (row.relationship_type === 'child') {
    const iAmTheParent = row.client_id === meId
    return t(byGender(iAmTheParent ? CHILD_KEY : PARENT_KEY, otherGender))
  }
  const map = SYMMETRIC_KEYS[row.relationship_type]
  return map ? t(byGender(map, otherGender)) : row.relationship_type
}

// Returns the id of the "other" client in a relationship row, given my id.
export function getOtherClientId(row, meId) {
  return row.client_id === meId ? row.related_client_id : row.client_id
}
