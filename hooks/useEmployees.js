import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useEmployees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('created_at')
    setEmployees(data || [])
    setLoading(false)
  }

  return { employees, loading, reload: load }
}
