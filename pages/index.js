import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../components/AuthGate'
import ClientsApp from '../components/ClientsApp'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'clientsList', 'clientForm', 'clientProfile', 'topBar'])),
    },
  }
}

export default function Home() {
  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <ClientsApp userEmail={session.user.email} salonId={salonId} onLogout={logout} />
      )}
    </AuthGate>
  )
}
