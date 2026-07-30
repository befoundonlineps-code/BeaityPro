import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import EmployeesApp from '../../components/EmployeesApp'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'employees', 'settings', 'topBar'])),
    },
  }
}

export default function EmployeesPage() {
  const { t } = useTranslation(['employees', 'common'])

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('employees:breadcrumbEmployees')}</span>
              {' / '}<span>{t('employees:breadcrumbList')}</span>
            </div>
          </div>
          <div className="p-5">
            <EmployeesApp salonId={salonId} />
          </div>
        </AppShell>
      )}
    </AuthGate>
  )
}
