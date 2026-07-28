import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../hooks/useAuthSession'
import LoginScreen from '../components/LoginScreen'
import ClientsApp from '../components/ClientsApp'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'clientsList', 'clientForm', 'clientProfile', 'topBar'])),
    },
  }
}

export default function Home() {
  const { t } = useTranslation('common')
  const { session, salonId, loading, logout } = useAuthSession()

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{t('loading')}</div>
  }
  if (!session) {
    return <LoginScreen />
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{t('loadingSalonData')}</div>
  }
  return <ClientsApp userEmail={session.user.email} salonId={salonId} onLogout={logout} />
}
