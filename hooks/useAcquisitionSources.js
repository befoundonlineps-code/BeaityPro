import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAcquisitionSources() {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('acquisition_sources').select('*').order('created_at')
    setSources(data || [])
    setLoading(false)
  }

  return { sources, loading, reload: load }
}
