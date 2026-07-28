import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// A lightweight full client list for display lookups (calendar blocks,
// waiting list) — not for searching, see useClientSearch for that.
export function useClientsLookup() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('id, first_name, last_name, phone_number')
    setClients(data || [])
    setLoading(false)
  }

  return { clients, loading, reload: load }
}
