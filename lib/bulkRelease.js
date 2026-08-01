// Which bookings a bulk release touches, and what happens to each one.
//
// Two outcomes that must never be blurred together: a session whose *main*
// professional is gone gets cancelled whole and its client goes back to the
// waiting list, while a session where the absent person was only an extra
// pair of hands keeps running and merely loses that participant. The
// preview shows both, separately, because they mean different things to the
// client — one of them needs a phone call, the other does not.
//
// The database is the real guarantee: bulk_release_to_waiting re-derives
// this same set under FOR UPDATE rather than trusting a list sent from the
// browser, so a booking made while the dialog sat open is still caught.
// Nothing here is load-bearing for correctness — it decides what to show,
// and the rules live here rather than inline so the preview and the
// function can be read against each other.

// The two live states. Everything else is either history (cancelled,
// rescheduled, adjusted, no_show), already delivered (completed), or has no
// employee and no time to begin with (waiting).
export const RELEASABLE_STATUSES = ['booked', 'pending_approval']

// Time that has already started is never touched, on any day in the range.
//
// A booking that began before now may well have been delivered — the row
// still says `booked` because nobody walked over and marked it completed,
// and no column tells the two apart. Cancelling it would rewrite something
// that actually happened. So this is a hard floor, not a default the dialog
// could offer to relax: one stale row left behind is cleaned up
// individually and costs a minute, while a falsified history is not
// recoverable at all.
//
// A waiting entry has no start_time and so is never "after" anything, which
// is the answer we want — it holds no slot and no employee, so a bulk
// release has nothing to take from it.
export function startsAfter(row, cutoff) {
  if (!row || !row.start_time) return false
  return new Date(row.start_time) >= cutoff
}

// An employee is matched by their own row; a resource by the units it is
// made of. "The whole resource" is not a second mode — it is every unit id
// instead of one, so both take the same path and only the caller differs.
export function matchesTarget(row, target) {
  if (!row || !target) return false
  if (target.kind === 'employee') {
    return !!target.employeeId && row.employee_id === target.employeeId
  }
  if (target.kind === 'resourceUnits') {
    return !!row.resource_unit_id && (target.unitIds || []).includes(row.resource_unit_id)
  }
  return false
}

// Earliest first, so the preview reads like the day does. Ties break on id
// only to keep the order stable between two renders of the same data.
function byStartTime(a, b) {
  const diff = new Date(a.start_time) - new Date(b.start_time)
  if (diff !== 0) return diff
  return String(a.id).localeCompare(String(b.id))
}

// The whole plan, split by what each row will actually get done to it.
//
// toCancel holds primaries: cancel_appointment clears the session and one
// waiting entry is created for the client. toRemove holds participants:
// remove_participant takes just that row off and the session carries on, so
// no waiting entry is created — the client is still being seen.
//
// A resource target can only ever fill toCancel. Only the primary row of a
// session may hold a resource_unit_id, which appointments_group_resource_check
// enforces in the database, so a participant can never be the one matched by
// a broken unit.
export function classifyBulkRelease({ appointments, target, cutoff }) {
  const affected = (appointments || [])
    .filter((row) => RELEASABLE_STATUSES.includes(row?.status))
    .filter((row) => startsAfter(row, cutoff))
    .filter((row) => matchesTarget(row, target))
    .sort(byStartTime)

  return {
    toCancel: affected.filter((row) => row.is_primary),
    toRemove: affected.filter((row) => !row.is_primary),
  }
}
