import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Dated one-day additions to an employee's shift, each opened by confirming
// a booking that fell outside the recurring pattern. Loaded whole rather
// than per-day: there is one row per confirmed out-of-hours booking, so the
// table stays small, and the calendar can move between days without
// refetching.
export function useScheduleExceptions() {
  const [exceptionsByEmployee, setExceptionsByEmployee] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employee_schedule_exceptions').select('*')
    const map = {}
    for (const row of data || []) {
      if (!map[row.employee_id]) map[row.employee_id] = []
      map[row.employee_id].push(row)
    }
    setExceptionsByEmployee(map)
    setLoading(false)
  }

  return { exceptionsByEmployee, loading, reload: load }
}
