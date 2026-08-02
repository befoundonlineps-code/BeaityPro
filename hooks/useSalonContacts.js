import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// People to ring who have no row in employees: the owner, a supplier, the
// engineer who fixes the laser. Name and number, nothing else — they have no
// role, no shift and no login.
export function useSalonContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('salon_contacts')
      .select('*')
      .order('sort_order')
      .order('created_at')
    setContacts(data || [])
    setLoading(false)
  }

  return { contacts, loading, reload: load }
}
