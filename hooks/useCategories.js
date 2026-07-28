import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('created_at')
    setCategories(data || [])
    setLoading(false)
  }

  return { categories, loading, reload: load }
}
