// Who can be taken off a session, and who cannot.
//
// This mirrors the two refusals inside remove_participant. The database is
// the real guarantee — this only decides whether to offer the button, so a
// receptionist is never handed a control that was always going to fail.
// If the two ever drift, the database wins and the button turns into an
// error message, which is why the rule is written once and tested rather
// than spelled out inline at the call site.

const REMOVABLE_STATUSES = ['booked', 'pending_approval']

export function canRemoveParticipant(row) {
  if (!row) return false
  // The primary is the session. Taking them off means cancelling it, which
  // is a different action with its own button and its own propagation.
  if (row.is_primary) return false
  return REMOVABLE_STATUSES.includes(row.status)
}

// Primary first, so the roster reads the same whichever block on the
// calendar was clicked to open it.
export function sortPrimaryFirst(rows) {
  return [...(rows || [])].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
}
