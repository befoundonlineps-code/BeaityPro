import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Why somebody is off: sickness, leave, training, unexplained. Every reason,
// active and inactive — the picker offers only active ones, while the manager
// dialog shows both so a deactivated reason can still be reactivated.
//
// Deliberately not the cancellation reasons: those answer why a *booking*
// died, and mixing the two lists would offer "training" when cancelling a
// booking and "client changed their mind" when marking somebody sick.
export function useAbsenceReasons() {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('absence_reasons').select('*').order('sort_order').order('created_at')
    setReasons(data || [])
    setLoading(false)
  }

  return { reasons, loading, reload: load }
}
