import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useBusinessTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('salon_business_types').select('*')
    setTypes((data || []).map((r) => r.business_type))
    setLoading(false)
  }

  return { types, loading, reload: load }
}
