import { useState, useEffect } from 'react'
import { fetchProductOrders } from '../lib/productOrderIO'

// The goods orders and their lines.
//
// Both together, for the reason useStockDocuments keeps: an order without its
// lines is a row saying "we ordered something from somebody in March", and the
// list draws a total from the lines rather than from a stored column — because
// a stored total is a second statement of what the lines already say.
//
// ⚠️ The whole read lives in lib/productOrderIO.js rather than here, unlike the
// hooks beside it. These two tables are written straight from the client with
// no function in front of them, so the read and the writes share a file where
// tests can reach both — and the failure rule ("both or neither") is stated
// once, next to the requests it governs.
export function useProductOrders() {
  const [orders, setOrders] = useState([])
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const result = await fetchProductOrders()
      if (!result.ok) {
        // ⚠️ Read rather than dropped. This list is legitimately empty on a
        // fresh salon and the screen says so in words — so a swallowed failure
        // would not fail, it would reassure.
        setError(result.error || new Error('product_orders read returned nothing'))
        return
      }
      setError(null)
      setOrders(result.orders)
      setLines(result.lines)
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { orders, lines, loading, error, reload: load }
}
