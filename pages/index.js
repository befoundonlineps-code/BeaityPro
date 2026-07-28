import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../hooks/useAuthSession'
import LoginScreen from '../components/LoginScreen'
import ClientsApp from '../components/ClientsApp'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'clientsList', 'clientForm'])),
    },
  }
}

export default function Home() {
  const { session, salonId, loading, logout } = useAuthSession()

  if (session === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">جاري التحميل...</div>
  }
  if (!session) {
    return <LoginScreen />
  }
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">جاري تحميل بيانات الصالون...</div>
  }
  return <ClientsApp userEmail={session.user.email} salonId={salonId} onLogout={logout} />
}
