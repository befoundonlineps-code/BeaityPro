import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// The products catalogue: the folders and the products in them.
//
// Storages are deliberately not fetched here yet. The screen has nothing to
// do with them until there are stock movements to filter by storage, and a
// query whose result nothing reads is exactly the waste already noted against
// this screen's neighbour in the handoff priorities.
//
// ⚠️ This reads `error`, which no other hook in this project does — every one
// of them takes `data || []` and drops the rest. That was survivable on the
// services screen, where the catalogue is seeded: a failed read draws a blank
// list nobody believes. It is not survivable here, because this catalogue is
// legitimately empty today and the screen says so in words. A swallowed error
// would not fail silently, it would reassure — "the products catalogue starts
// out empty" turns a broken query into a normal state in the reader's mind.
// It is the same rule the writes already follow, no error and no rows is a
// refusal rather than a success, applied to a read for the first time.
export function useProductCatalog() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cats, prods] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*').order('sort_order'),
    ])

    const failure = cats.error || prods.error
    if (failure) {
      // What was on screen stays on screen. Replacing it with [] would turn a
      // failed refresh into an empty catalogue — the same lie, told about a
      // catalogue that had rows a second ago instead of one that never did.
      setError(failure)
      setLoading(false)
      return
    }

    setError(null)
    setCategories(cats.data || [])
    setProducts(prods.data || [])
    setLoading(false)
  }

  return { categories, products, loading, error, reload: load }
}
