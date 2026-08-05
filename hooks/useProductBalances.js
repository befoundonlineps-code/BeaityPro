import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// The balances view, for every storage at once.
//
// ⚠️ `error` is kept and never swallowed, and this hook is new so it does NOT
// inherit the fix useProductCatalog got — item 26 had to be made again here.
// The reason is sharper on this screen than anywhere else: a balance list is
// legitimately empty on a fresh salon, so a failed read rendered as "nothing
// here" does not fail, it REASSURES. Somebody would read "no stock recorded"
// off a screen whose query never came back.
//
// ⚠️ And the rows are fetched for all storages rather than filtered in the
// query, because the screen has to be able to say what a single storage's
// zero is made of: مبرد ومهدئ ليزر is -75 in one storage and +75 in another,
// and a sum over both is a clean zero that means "no problem" — the one thing
// that must never be said here.
export function useProductBalances() {
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error: readError } = await supabase.from('product_balances').select('*')
      if (readError) {
        setError(readError)
        return
      }
      setError(null)
      setBalances(data || [])
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { balances, loading, error, reload: load }
}
