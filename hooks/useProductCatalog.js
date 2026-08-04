import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// The products catalogue: the folders and the products in them.
//
// Storages are deliberately not fetched here yet. The screen has nothing to
// do with them until there are stock movements to filter by storage, and a
// query whose result nothing reads is exactly the waste already noted against
// this screen's neighbour in the handoff priorities.
export function useProductCatalog() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cats, prods] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*').order('sort_order'),
    ])
    setCategories(cats.data || [])
    setProducts(prods.data || [])
    setLoading(false)
  }

  return { categories, products, loading, reload: load }
}
