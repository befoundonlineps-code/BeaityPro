import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { DotPattern } from '@/components/ui/dot-pattern'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginScreen() {
  const { t } = useTranslation(['login', 'common'])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(t('login:invalidCredentials'))
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <DotPattern
        glow
        className="text-primary/50 [mask-image:radial-gradient(480px_circle_at_center,white,transparent)]"
      />

      <Card className="relative z-10 w-[360px] shadow-lg">
        <CardContent className="pt-2">
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="mb-1 flex flex-col items-center gap-1.5 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">B</div>
              <h2 className="text-lg font-semibold text-foreground">{t('common:appName')}</h2>
              <p className="text-xs text-muted-foreground">{t('login:heading')}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">{t('login:emailLabel')}</Label>
              <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t('login:passwordLabel')}</Label>
              <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('login:submitButtonLoading') : t('login:submitButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
