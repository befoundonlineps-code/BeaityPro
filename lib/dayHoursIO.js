import { supabase } from './supabaseClient'

// Hours set by hand for one professional on one day.
//
// A row here replaces the recurring pattern for that date only; deleting it
// hands the day back to the pattern. Nothing else changes — the weekly
// schedule is never written to, which is the whole reason this lives in its
// own table rather than editing employee_schedules.

// One row per employee per day, so setting hours twice corrects them rather
// than stacking two answers. The unique constraint is what makes that safe;
// the upsert just tells Postgres which conflict it is resolving.
export async function setEmployeeDayHours({ salonId, employeeId, dateISO, startTime, endTime }) {
  return supabase
    .from('employee_day_hours')
    .upsert(
      {
        salon_id: salonId,
        employee_id: employeeId,
        work_date: dateISO,
        start_time: startTime,
        end_time: endTime,
      },
      { onConflict: 'employee_id,work_date' }
    )
    .select()
}

// Back to the weekly pattern. Not an undo of anything that happened to
// bookings — narrowing a day never moved them, so there is nothing to put
// back.
export async function clearEmployeeDayHours({ employeeId, dateISO }) {
  return supabase
    .from('employee_day_hours')
    .delete()
    .eq('employee_id', employeeId)
    .eq('work_date', dateISO)
}
