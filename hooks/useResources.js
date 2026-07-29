import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Resources, their internal units, and which services may use them.
// Units are maintained by a database trigger from each resource's
// capacity — nothing in the app ever writes to resource_units.
export function useResources() {
  const [resources, setResources] = useState([])
  const [units, setUnits] = useState([])
  const [serviceResources, setServiceResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [res, unitRes, linkRes] = await Promise.all([
      supabase.from('resources').select('*').order('sort_order'),
      supabase.from('resource_units').select('*'),
      supabase.from('service_resources').select('*'),
    ])
    setResources(res.data || [])
    setUnits(unitRes.data || [])
    setServiceResources(linkRes.data || [])
    setLoading(false)
  }

  return { resources, units, serviceResources, loading, reload: load }
}
