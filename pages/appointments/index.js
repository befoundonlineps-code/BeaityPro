import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
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

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
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
      )}
    </AuthGate>
  )
}
