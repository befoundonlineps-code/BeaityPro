import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useServiceRolePrices() {
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('service_role_prices').select('*')
    setPrices(data || [])
    setLoading(false)
  }

  return { prices, loading, reload: load }
}
