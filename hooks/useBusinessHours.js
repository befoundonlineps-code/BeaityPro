import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useBusinessHours() {
  const [hours, setHours] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('business_hours').select('*').order('day_of_week')
    setHours(data || [])
    setLoading(false)
  }

  return { hours, loading, reload: load }
}
