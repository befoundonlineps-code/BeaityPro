import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { page } from '../styles'
import LoginScreen from '../components/LoginScreen'
import ClientsApp from '../components/ClientsApp'

export default function Home() {
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

  async function handleLogout() {
    await supabase.auth.signOut()
    setSalonId(null)
  }

  if (session === undefined) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري التحميل...</div>
  }
  if (!session) {
    return <LoginScreen />
  }
  if (profileLoading) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>جاري تحميل بيانات الصالون...</div>
  }
  return <ClientsApp userEmail={session.user.email} salonId={salonId} onLogout={handleLogout} />
}
