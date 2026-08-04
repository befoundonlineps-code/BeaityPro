import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ProductsBrowser from '../../components/ProductsBrowser'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'products', 'employees', 'settings', 'topBar'])),
    },
  }
}

export default function ProductsPage() {
  const { t } = useTranslation(['products', 'common'])

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('products:breadcrumbProducts')}</span>
              {' / '}
              <span>{t('products:breadcrumbCatalog')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <ProductsBrowser salonId={salonId} />
          </div>
        </AppShell>
      )}
    </AuthGate>
  )
}
