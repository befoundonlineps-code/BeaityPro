import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../../hooks/useAuthSession'
import LoginScreen from '../../components/LoginScreen'
import AppShell from '../../components/AppShell'
import AppointmentCalendar from '../../components/AppointmentCalendar'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'appointments', 'employees', 'services', 'clientsList', 'topBar'])),
    },
  }
}

export default function AppointmentsPage() {
  const { t } = useTranslation(['appointments', 'common'])
  const { session, salonId, loading, logout } = useAuthSession()

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
          <span className="font-semibold text-primary">{t('appointments:breadcrumbAppointments')}</span>
          {' / '}<span>{t('appointments:breadcrumbCalendar')}</span>
        </div>
      </div>
      <div className="p-5">
        <AppointmentCalendar salonId={salonId} />
      </div>
    </AppShell>
  )
}
