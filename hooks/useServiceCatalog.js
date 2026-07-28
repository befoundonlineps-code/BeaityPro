import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useServiceCatalog() {
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cats, svcs] = await Promise.all([
      supabase.from('service_categories').select('*').order('sort_order'),
      supabase.from('services').select('*').order('sort_order'),
    ])
    setCategories(cats.data || [])
    setServices(svcs.data || [])
    setLoading(false)
  }

  return { categories, services, loading, reload: load }
}
