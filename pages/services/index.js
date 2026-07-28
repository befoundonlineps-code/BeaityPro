import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../../hooks/useAuthSession'
import LoginScreen from '../../components/LoginScreen'
import AppShell from '../../components/AppShell'
import ServicesTree from '../../components/ServicesTree'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'services', 'settings', 'topBar'])),
    },
  }
}

export default function ServicesPage() {
  const { t } = useTranslation(['services', 'common'])
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
          <span className="font-semibold text-primary">{t('services:breadcrumbServices')}</span>
          {' / '}<span>{t('services:breadcrumbCatalog')}</span>
        </div>
      </div>
      <div className="p-5">
        <ServicesTree salonId={salonId} />
      </div>
    </AppShell>
  )
}
