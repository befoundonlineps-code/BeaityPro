import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { weekBounds } from '../lib/calendarWeek'
import { VIEW_EMPLOYEE, VIEW_RESOURCE } from '../lib/calendarView'

// A week of one professional's, or one resource's, appointments.
//
// Narrow on purpose. The day view fetches everything happening on one day
// because it draws everybody; a week view draws one subject, so it fetches
// that subject over seven days instead — the same order of magnitude either
// way, rather than the whole salon's week.
//
// Only runs while a single subject is selected. Every other view stays on the
// day query it already had, and this hook returns an empty week so the
// calendar never has to ask which of the two it is looking at.
export function useSubjectWeek({ selection, dateISO, unitIdsByResource }) {
  const [weekAppointments, setWeekAppointments] = useState([])
  const [loading, setLoading] = useState(false)

  const kind = selection?.kind
  const isEmployee = kind === VIEW_EMPLOYEE
  const isResource = kind === VIEW_RESOURCE
  const subjectId = isEmployee ? selection.employeeId : isResource ? selection.resourceId : null
  // Joined rather than passed as an array so the effect is not re-run by a
  // fresh array with identical contents on every render.
  const unitKey = isResource ? (unitIdsByResource[subjectId] || []).join(',') : ''

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!subjectId) {
        setWeekAppointments([])
        return
      }
      const bounds = weekBounds(dateISO)
      if (!bounds) return

      setLoading(true)
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', bounds.from.toISOString())
        .lt('start_time', bounds.to.toISOString())

      if (isEmployee) {
        query = query.eq('employee_id', subjectId)
      } else {
        const unitIds = unitKey ? unitKey.split(',') : []
        // A resource with no units can hold nothing; asking `in ()` would
        // return the whole table rather than nothing.
        if (unitIds.length === 0) {
          if (!cancelled) { setWeekAppointments([]); setLoading(false) }
          return
        }
        query = query.in('resource_unit_id', unitIds)
      }

      const { data } = await query
      if (cancelled) return
      setWeekAppointments(data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [subjectId, isEmployee, dateISO, unitKey])

  return { weekAppointments, loading }
}
