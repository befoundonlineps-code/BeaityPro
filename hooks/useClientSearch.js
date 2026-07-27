import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useClientSearch(excludeId) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    const q = search.trim().replace(/,/g, '')
    if (q.length < 2) {
      setResults([])
      return undefined
    }
    const t = setTimeout(async () => {
      let query = supabase
        .from('clients')
        .select('id,first_name,last_name,phone_number,gender')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
        .limit(6)
      if (excludeId) query = query.neq('id', excludeId)
      const { data } = await query
      setResults(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search, excludeId])

  return { search, setSearch, results }
}
