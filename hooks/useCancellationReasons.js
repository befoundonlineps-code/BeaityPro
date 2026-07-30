import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Every reason, active and inactive. A cancel dropdown only offers active
// ones; the manager dialog shows both so a deactivated reason can still be
// found and reactivated.
export function useCancellationReasons() {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cancellation_reasons').select('*').order('sort_order').order('created_at')
    setReasons(data || [])
    setLoading(false)
  }

  return { reasons, loading, reload: load }
}
