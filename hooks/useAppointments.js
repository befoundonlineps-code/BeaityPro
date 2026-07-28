import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// dayAppointments: every non-waiting appointment whose start_time falls on `dateISO`.
// waitingAppointments: the salon's whole waiting list — it has no start_time, so it
// isn't tied to any single day.
export function useAppointments(dateISO) {
  const [dayAppointments, setDayAppointments] = useState([])
  const [waitingAppointments, setWaitingAppointments] = useState([])
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

    setDayAppointments(dayRes.data || [])
    setWaitingAppointments(waitingRes.data || [])
    setLoading(false)
  }

  return { dayAppointments, waitingAppointments, loading, reload: load }
}
