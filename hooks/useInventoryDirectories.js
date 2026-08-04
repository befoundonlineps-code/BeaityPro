import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// The storages and the suppliers, with the rows that hang off each.
//
// One hook for both because both screens need both: the product window's
// consignment dropdown wants suppliers while standing on the products screen,
// and the storage window wants nothing from suppliers but is reached from the
// same bar. Two hooks would mean two loading states and two failure states on
// one screen, and the second would be the one nobody wires up.
//
// ⚠️ `error` is read rather than dropped, the same as useProductCatalog and for
// the same reason: both of these catalogues are legitimately empty today and
// the screens say so in words. A swallowed error here would not fail silently,
// it would reassure — "you have not added any suppliers yet" is a sentence a
// broken query should never be able to produce.
export function useInventoryDirectories() {
  const [storages, setStorages] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [st, resp, sup, cont] = await Promise.all([
        supabase.from('storages').select('*').order('sort_order'),
        supabase.from('storage_responsibles').select('*'),
        supabase.from('suppliers').select('*').order('sort_order'),
        supabase.from('supplier_contacts').select('*').order('sort_order'),
      ])

      // Any one of them failing fails all four. A storage list read with its
      // responsibles missing is not a half-loaded screen, it is a screen that
      // says nobody is answerable for anything.
      const failure = st.error || resp.error || sup.error || cont.error
      if (failure) {
        // What was on screen stays on screen. Replacing it with [] would turn
        // a failed refresh into an empty directory.
        setError(failure)
        return
      }

      setError(null)
      setStorages(st.data || [])
      setResponsibles(resp.data || [])
      setSuppliers(sup.data || [])
      setContacts(cont.data || [])
    } catch (thrown) {
      // supabase-js returns fetch failures in `error` rather than throwing, so
      // this is unlikely — which is the reason to have it. Without it a throw
      // skips every line below and `loading` stays true forever.
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { storages, responsibles, suppliers, contacts, loading, error, reload: load }
}
