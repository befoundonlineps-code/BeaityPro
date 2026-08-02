import { supabase } from './supabaseClient'
import { availableWindowsForDate } from './employeeAvailability'
import { serviceUsesResources, orderedUnitsForService } from './resourceAllocation'
import { resolvePlacementWindow, evaluatePlacement, isServiceAllowedForRole } from './bookingPlacement'
import { loadOccupancy, attemptOnEachUnit } from './placementIO'

// Everything the two reschedule entry points do between "here is a new
// time" and "it is saved". The dialog and the drag gesture differ only in
// how the receptionist names the new slot; from that point on they must
// behave identically, so they share this rather than each assembling the
// same steps.

// Which message each refusal turns into, shared by both callers so a
// dragged booking and a rescheduled one never explain themselves
// differently.
export const RESCHEDULE_ERROR_KEYS = {
  past: 'appointments:formDialog.pastTimeError',
  roleMismatch: 'appointments:formDialog.roleMismatchError',
  conflict: 'appointments:formDialog.conflictError',
  resourcesBusy: 'appointments:formDialog.allResourcesBusyError',
}

// Works out whether the move is allowed, without writing anything.
//
// Returns { plan, start, end, employee } — plan.ok false carries a reason,
// plan.ok true carries outsideSchedule (a question, not a refusal) and the
// units that may be claimed. A failed round-trip comes back as { error }.
export async function planReschedule({
  appointment, service, employeeId, requestedStart,
  employees, services, categories, roleBusinessTypes,
  schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, dayHoursByEmployee,
  resources, resourceUnits, serviceResources,
}) {
  const placement = resolvePlacementWindow(requestedStart, service, new Date())
  if (!placement) return { plan: { ok: false, reason: 'past' } }
  const { start, end } = placement

  const { employeeRows, unitRows, error } = await loadOccupancy({ employeeId, start, end })
  if (error) return { error }

  const employee = (employees || []).find((e) => e.id === employeeId)
  const scheduleEntry = (schedulesByEmployee || {})[employeeId]

  const plan = evaluatePlacement({
    start,
    end,
    windows: availableWindowsForDate(
      scheduleEntry?.schedule,
      scheduleEntry?.slots,
      (exceptionsByEmployee || {})[employeeId],
      start,
      (absencesByEmployee || {})[employeeId],
      (dayHoursByEmployee || {})[employeeId]
    ),
    roleAllowed: isServiceAllowedForRole(employee?.role, service, services, categories, roleBusinessTypes),
    employeeAppointments: employeeRows,
    // The booking is still sitting in its old slot while this runs, so it
    // must not be found conflicting with itself.
    excludeAppointmentId: appointment.id,
    orderedUnits: serviceUsesResources(service.id, serviceResources)
      ? orderedUnitsForService(service.id, serviceResources, resources, resourceUnits)
      : [],
    unitAppointments: unitRows,
  })

  return { plan, start, end, employee }
}

// Writes the move. The old row becomes history and a new one is created,
// both inside reschedule_appointment's single transaction — so a unit that
// was taken in the meantime simply rolls the whole attempt back and the
// next candidate is tried.
//
// rescheduleReasonId is mandatory the same way a cancellation reason is:
// the database itself refuses a null one, so a caller that forgets to
// collect it fails loudly rather than silently.
export async function commitReschedule({ appointment, employeeId, start, end, plan, rescheduleReasonId }) {
  return attemptOnEachUnit(plan.candidateUnits, (unit) =>
    supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointment.id,
      p_new_start: start.toISOString(),
      p_new_end: end.toISOString(),
      p_new_employee_id: employeeId,
      p_provisional: plan.outsideSchedule,
      p_resource_unit_id: unit ? unit.id : null,
      p_reschedule_reason_id: rescheduleReasonId,
    })
  )
}

// Turns whatever came back from commitReschedule into a message key, or
// null when it worked.
export function rescheduleErrorKey({ error, kind, exhausted, data }) {
  if (error) {
    if (exhausted) return 'appointments:formDialog.allResourcesBusyError'
    if (kind === 'employee') return 'appointments:formDialog.conflictError'
    if (error.message?.includes('appointment_not_reschedulable')) {
      return 'appointments:rescheduleDialog.notReschedulableError'
    }
    if (error.message?.includes('reschedule_reason_required')) {
      // The UI disables the confirm button until a reason is picked, so this
      // is a backstop, not a path a receptionist should ever actually hit.
      return 'appointments:rescheduleDialog.reasonRequiredError'
    }
    return null // caller falls back to the raw message
  }
  if (!data) return 'appointments:rescheduleDialog.noRowsError'
  return null
}
