import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// One entry per employee that has a schedule: { schedule, slots }. An
// employee with no row here has no schedule at all — callers treat that
// the same as "no available hours today" (see lib/employeeAvailability).
export function useEmployeeSchedules() {
  const [schedulesByEmployee, setSchedulesByEmployee] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [schedulesRes, slotsRes] = await Promise.all([
      supabase.from('employee_schedules').select('*'),
      supabase.from('employee_schedule_slots').select('*'),
    ])
    const schedules = schedulesRes.data || []
    const slots = slotsRes.data || []
    const map = {}
    for (const schedule of schedules) {
      map[schedule.employee_id] = {
        schedule,
        slots: slots.filter((s) => s.schedule_id === schedule.id),
      }
    }
    setSchedulesByEmployee(map)
    setLoading(false)
  }

  return { schedulesByEmployee, loading, reload: load }
}
