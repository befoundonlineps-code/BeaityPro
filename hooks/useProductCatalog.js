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
    try {
      const [cats, prods] = await Promise.all([
        supabase.from('product_categories').select('*').order('sort_order'),
        supabase.from('products').select('*').order('sort_order'),
      ])

      // Either query failing fails both. A catalogue with its folders read and
      // its products missing is not a half-loaded catalogue, it is a wrong one.
      const failure = cats.error || prods.error
      if (failure) {
        // What was on screen stays on screen. Replacing it with [] would turn
        // a failed refresh into an empty catalogue — the same lie, told about
        // a catalogue that had rows a second ago instead of one that never did.
        setError(failure)
        return
      }

      setError(null)
      setCategories(cats.data || [])
      setProducts(prods.data || [])
    } catch (thrown) {
      // supabase-js catches fetch failures and returns them in `error` rather
      // than throwing, so this is unlikely — which is the reason to have it.
      // Without it a throw skips every line below and `loading` stays true
      // forever, leaving the overlay sitting over a screen that will never
      // load: no data, no error, no retry. That is this file's own subject —
      // a screen that reassures while broken — coming in through a third door,
      // and it would rest on a library's promise not to change its mind.
      setError(thrown)
    } finally {
      // Every path, including the two returns above and anything thrown.
      setLoading(false)
    }
  }

  return { categories, products, loading, error, reload: load }
}
