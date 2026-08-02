import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Who is off, which machines are down, and whose hours were set by hand —
// on which days.
//
// Both are loaded whole rather than per-day, the same way schedule exceptions
// are: a row exists only for a day somebody was actually away, so the tables
// stay small, and the calendar can move between days without refetching.
//
// Keyed the way the calendar consumes them — by employee and by unit — so a
// column can ask about its own owner without scanning.
export function useDayStatus() {
  const [absencesByEmployee, setAbsencesByEmployee] = useState({})
  const [outagesByUnit, setOutagesByUnit] = useState({})
  const [dayHoursByEmployee, setDayHoursByEmployee] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [absenceRes, outageRes, hoursRes] = await Promise.all([
      supabase.from('employee_absences').select('*'),
      supabase.from('resource_unit_outages').select('*'),
      supabase.from('employee_day_hours').select('*'),
    ])

    const byEmployee = {}
    for (const row of absenceRes.data || []) {
      if (!byEmployee[row.employee_id]) byEmployee[row.employee_id] = []
      byEmployee[row.employee_id].push(row)
    }

    const byUnit = {}
    for (const row of outageRes.data || []) {
      if (!byUnit[row.resource_unit_id]) byUnit[row.resource_unit_id] = []
      byUnit[row.resource_unit_id].push(row)
    }

    const hoursByEmployee = {}
    for (const row of hoursRes.data || []) {
      if (!hoursByEmployee[row.employee_id]) hoursByEmployee[row.employee_id] = []
      hoursByEmployee[row.employee_id].push(row)
    }

    setAbsencesByEmployee(byEmployee)
    setOutagesByUnit(byUnit)
    setDayHoursByEmployee(hoursByEmployee)
    setLoading(false)
  }

  return { absencesByEmployee, outagesByUnit, dayHoursByEmployee, loading, reload: load }
}
