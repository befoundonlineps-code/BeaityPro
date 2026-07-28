import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../../hooks/useAuthSession'
import LoginScreen from '../../components/LoginScreen'
import AppShell from '../../components/AppShell'
import WorkingHoursSettings from '../../components/WorkingHoursSettings'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'settings', 'topBar'])),
    },
  }
}

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common'])
  const { session, loading, logout } = useAuthSession()
  const PAGE_LOADING = (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{t('common:loading')}</div>
  )

  if (session === undefined) return PAGE_LOADING
  if (!session) return <LoginScreen />
  if (loading) return PAGE_LOADING

  return (
    <AppShell userEmail={session.user.email} onLogout={logout}>
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{t('settings:workingHours.breadcrumbSettings')}</span>
          {' / '}<span>{t('settings:workingHours.breadcrumbWorkingHours')}</span>
        </div>
      </div>
      <div className="p-5">
        <WorkingHoursSettings />
      </div>
    </AppShell>
  )
}
