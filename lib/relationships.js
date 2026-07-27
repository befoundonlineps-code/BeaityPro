export const RELATIONSHIP_TYPES = [
  { value: 'spouse', label: 'زوج / زوجة' },
  { value: 'child', label: 'ابن / ابنة' },
  { value: 'friend', label: 'صديق' },
  { value: 'colleague', label: 'زميل' },
]

const SYMMETRIC_LABELS = {
  spouse: { male: 'زوج', female: 'زوجة', other: 'الزوج/الزوجة' },
  friend: { male: 'صديق', female: 'صديقة', other: 'صديق' },
  colleague: { male: 'زميل', female: 'زميلة', other: 'زميل' },
}

const CHILD_LABEL = { male: 'ابن', female: 'ابنة', other: 'ابن/ابنة' }
const PARENT_LABEL = { male: 'الأب', female: 'الأم', other: 'الوالد/ة' }

function byGender(map, gender) {
  return map[gender] || map.other
}

// row: { client_id, related_client_id, relationship_type }
// meId: the profile currently being viewed
// otherGender: the gender ('male' | 'female' | other) of the OTHER client in the row
export function getRelationshipLabel(row, meId, otherGender) {
  if (row.relationship_type === 'child') {
    const iAmTheParent = row.client_id === meId
    return byGender(iAmTheParent ? CHILD_LABEL : PARENT_LABEL, otherGender)
  }
  const map = SYMMETRIC_LABELS[row.relationship_type]
  return map ? byGender(map, otherGender) : row.relationship_type
}

// Returns the id of the "other" client in a relationship row, given my id.
export function getOtherClientId(row, meId) {
  return row.client_id === meId ? row.related_client_id : row.client_id
}
