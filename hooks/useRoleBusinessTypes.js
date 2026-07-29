import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Global, read-only reference data (see role_business_types migration) —
// no salon_id, no reload needed since nothing in the app ever writes to it.
export function useRoleBusinessTypes() {
  const [roleBusinessTypes, setRoleBusinessTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('role_business_types').select('*').then(({ data }) => {
      setRoleBusinessTypes(data || [])
      setLoading(false)
    })
  }, [])

  return { roleBusinessTypes, loading }
}
