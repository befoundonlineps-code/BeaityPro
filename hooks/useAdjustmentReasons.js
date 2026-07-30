import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Every adjustment reason, active and inactive — same shape as
// useCancellationReasons and useRescheduleReasons. The adjust dialog only
// offers active ones; the manager dialog shows both so a deactivated
// reason can still be found and reactivated.
export function useAdjustmentReasons() {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('adjustment_reasons').select('*').order('sort_order').order('created_at')
    setReasons(data || [])
    setLoading(false)
  }

  return { reasons, loading, reload: load }
}
