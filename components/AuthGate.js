import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { useAuthSession } from '../hooks/useAuthSession'
import LoginScreen from './LoginScreen'

function PageLoading() {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {t('loading')}
    </div>
  )
}

// The auth check every page repeats, with one rule none of them enforced on
// their own: once real content has rendered for a signed-in user, a
// `loading` flag turning true again for that *same* user never pulls it
// back down. Only a genuine identity change — signing out, or signing back
// in as someone else — is allowed to show the loading screen again.
//
// That rule matters because `loading` is not guaranteed to stay false
// forever after the first success. useAuthSession's own profile fetch is
// one way it can flip true again (Supabase replays auth events on tab
// refocus) — already fixed at the source — but the point of this component
// is to not depend on remembering that fix, or on tracking down whichever
// future hook does something similar. A `loading` flag from anywhere,
// present or future, cannot un-render an already-successful page: children
// are only ever removed for a real identity change.
//
// `identity` is undefined before the session resolves, null when signed
// out, and the user id once signed in — three states, not a boolean, so a
// real transition between them can be told apart from mere re-fetching.
export default function AuthGate({ children }) {
  const { session, salonId, loading, logout } = useAuthSession()
  const identity = session === undefined ? undefined : (session ? session.user.id : null)
  const [readyIdentity, setReadyIdentity] = useState(undefined)

  if (session === undefined) return <PageLoading />

  if (!session) {
    // Render-phase state adjustment (see "You Might Not Need an Effect" in
    // the React docs): signing out must re-arm the gate so signing back in,
    // even as the same user, shows the loading screen once again rather
    // than skipping straight to stale content.
    if (readyIdentity !== null) setReadyIdentity(null)
    return <LoginScreen />
  }

  if (readyIdentity !== identity) {
    if (loading) return <PageLoading />
    setReadyIdentity(identity)
  }

  return children({ session, salonId, logout })
}
