import { useTranslation } from 'next-i18next'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export default function AppHeader({ userEmail, onLogout }) {
  const { t } = useTranslation('common')
  const initial = (userEmail || '?').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          B
        </div>
        <span className="text-sm font-semibold text-foreground">{t('appName')}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>
        <Avatar size="sm">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <Button variant="outline" size="sm" onClick={onLogout}>{t('logout')}</Button>
      </div>
    </header>
  )
}
