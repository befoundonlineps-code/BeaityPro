import { resolveBookingStart, hasConflict } from './appointmentGrid'
import { isWithinAnyWindow } from './employeeAvailability'
import { availableUnitsFor } from './resourceAllocation'
import { servicesForRole } from './roleServiceFilter'

// Deciding whether a booking may sit at a given time, in one place.
//
// Three flows ask the same question — booking from the calendar, dragging a
// block to a new slot, and rescheduling to another day — and they must not
// answer it differently. The rules themselves live here, pure and testable;
// callers keep only the database round-trips, since the queries can't run
// until the window has been resolved.
//
// The work splits at exactly that seam: resolvePlacementWindow decides
// *when* (needed before any query), evaluatePlacement decides *whether*
// (needed after).

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// The span a booking would actually occupy, resolved against the clock as it
// is right now rather than the slot boundary drawn on screen. Returns null
// when the requested slot has already finished — callers treat that as a
// refusal, never as a clamp.
export function resolvePlacementWindow(requestedStart, service, now) {
  if (!requestedStart || !service) return null
  const start = resolveBookingStart(requestedStart, now)
  if (!start) return null
  return { start, end: new Date(start.getTime() + service.duration_minutes * 60000) }
}

// Can this employee's role perform this service at all?
//
// Unlike working hours, this is not a question anyone can say yes to: an
// employee whose role doesn't cover a service cannot be talked into
// covering it, so a drag onto the wrong column is refused outright rather
// than offered as a provisional booking.
export function isServiceAllowedForRole(role, service, services, categories, roleBusinessTypes) {
  if (!role || !service) return false
  return servicesForRole(role, services, categories, roleBusinessTypes).some((s) => s.id === service.id)
}

// Everything left to check once the window is known and the relevant rows
// have been fetched.
//
// Returns either a refusal with a reason the caller turns into a message, or
// an approval carrying two things: whether the slot falls outside the
// employee's shift — a question for the receptionist, not a refusal — and
// which resource units may be claimed, in fill order.
//
// excludeAppointmentId is what makes dragging work: the booking being moved
// is still occupying its old slot at this moment, so it would otherwise be
// found conflicting with itself.
export function evaluatePlacement({
  start,
  end,
  windows,
  roleAllowed,
  employeeAppointments,
  excludeAppointmentId,
  orderedUnits,
  unitAppointments,
}) {
  if (!roleAllowed) return { ok: false, reason: 'roleMismatch' }

  // Checked before the shift question on purpose: offering to hold a slot
  // provisionally is pointless when somebody already has it.
  if (hasConflict(start, end, employeeAppointments, excludeAppointmentId)) {
    return { ok: false, reason: 'conflict' }
  }

  const usesResources = (orderedUnits || []).length > 0
  const candidateUnits = usesResources
    ? availableUnitsFor(orderedUnits, unitAppointments, start, end, excludeAppointmentId)
    : [null] // no linked resource: one candidate, claiming nothing

  if (usesResources && candidateUnits.length === 0) {
    return { ok: false, reason: 'resourcesBusy' }
  }

  return {
    ok: true,
    outsideSchedule: !isWithinAnyWindow(windows, toHHMM(start), toHHMM(end)),
    candidateUnits,
  }
}

// Folds one evaluatePlacement result per participant into a single verdict
// for the whole session.
//
// entries is [{ key, employeeName, isPrimary, plan }] with the primary
// first, so a refusal that lands on the primary is the one reported — its
// message is the one the receptionist already knows from single bookings,
// and there is no point naming a participant when the main professional is
// the blocker anyway.
//
// Being outside the shift is collected rather than refused, and per person:
// a session where the main professional is on shift and the helper is not
// is perfectly ordinary, so only the ones actually outside it need holding
// provisionally.
export function combineGroupPlacement(entries) {
  const list = entries || []
  const failed = list.find((e) => !e.plan.ok)
  if (failed) return { ok: false, reason: failed.plan.reason, failed }

  return {
    ok: true,
    outsideKeys: list.filter((e) => e.plan.outsideSchedule).map((e) => e.key),
  }
}
