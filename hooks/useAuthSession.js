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

  useEffect(() => {
    if (session) {
      setProfileLoading(true)
      supabase.from('profiles').select('salon_id').eq('id', session.user.id).single()
        .then(({ data }) => {
          setSalonId(data ? data.salon_id : null)
          setProfileLoading(false)
        })
    }
  }, [session])

  async function logout() {
    await supabase.auth.signOut()
    setSalonId(null)
  }

  const loading = session === undefined || (!!session && profileLoading)

  return { session, salonId, loading, logout }
}
