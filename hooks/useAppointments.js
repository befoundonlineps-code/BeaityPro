import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// dayAppointments: every non-waiting appointment whose start_time falls on `dateISO`.
// waitingAppointments: the salon's whole waiting list — it has no start_time, so it
// isn't tied to any single day.
export function useAppointments(dateISO) {
  const [dayAppointments, setDayAppointments] = useState([])
  const [waitingAppointments, setWaitingAppointments] = useState([])
  const [releaseOriginsById, setReleaseOriginsById] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [dateISO])

  async function load() {
    setLoading(true)
    const dayStart = `${dateISO}T00:00:00`
    const dayEnd = `${dateISO}T23:59:59.999`

    const [dayRes, waitingRes] = await Promise.all([
      supabase.from('appointments').select('*').gte('start_time', dayStart).lte('start_time', dayEnd),
      supabase.from('appointments').select('*').eq('status', 'waiting').order('created_at'),
    ])

    const waiting = waitingRes.data || []

    // The booking each waiting entry came from, when it came from one at all.
    //
    // Fetched by id rather than embedded: PostgREST resolves a composite
    // foreign key to another table, but not one pointing back at the same
    // table, and appointments has three of those. Tried and refused with
    // PGRST200 — including on group_id and superseded_by_id, which have been
    // there far longer, so it is the shape of the key and not a stale cache.
    //
    // Being a lookup by id is also what makes this survive changing the day
    // on screen: the waiting list is not scoped to a date, and neither is
    // this, so an entry released from last Tuesday still says so on Friday.
    const originIds = [...new Set(waiting.map((a) => a.released_from_id).filter(Boolean))]
    let origins = []
    if (originIds.length > 0) {
      const { data } = await supabase
        .from('appointments')
        .select('id, start_time, employee_id, cancellation_reason_id')
        .in('id', originIds)
      origins = data || []
    }

    setDayAppointments(dayRes.data || [])
    setWaitingAppointments(waiting)
    setReleaseOriginsById(Object.fromEntries(origins.map((o) => [o.id, o])))
    setLoading(false)
  }

  return { dayAppointments, waitingAppointments, releaseOriginsById, loading, reload: load }
}
