import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuthSession() {
  const [session, setSession] = useState(undefined)
  const [salonId, setSalonId] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Depends on the user id, not the session object. Supabase hands us a
  // freshly-constructed session object on every auth event it replays —
  // notably on tab refocus, where it re-announces the same signed-in user
  // whether or not anything actually changed. Keying off the object itself
  // would re-run this fetch, and flip profileLoading back on, each time —
  // for no reason, since the id it would fetch is identical.
  const userId = session?.user?.id

  useEffect(() => {
    if (userId) {
      setProfileLoading(true)
      supabase.from('profiles').select('salon_id').eq('id', userId).single()
        .then(({ data }) => {
          setSalonId(data ? data.salon_id : null)
          setProfileLoading(false)
        })
    }
  }, [userId])

  async function logout() {
    await supabase.auth.signOut()
    setSalonId(null)
  }

  const loading = session === undefined || (!!session && profileLoading)

  return { session, salonId, loading, logout }
}
