import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ProductsBrowser from '../../components/ProductsBrowser'
import ProductsSecondaryBar from '../../components/ProductsSecondaryBar'
import StoragesManager from '../../components/StoragesManager'
import SuppliersManager from '../../components/SuppliersManager'
import { useInventoryDirectories } from '../../hooks/useInventoryDirectories'
import { useEmployees } from '../../hooks/useEmployees'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'products', 'employees', 'settings', 'topBar'])),
    },
  }
}

const BREADCRUMB = {
  catalog: 'products:breadcrumbCatalog',
  storages: 'products:breadcrumbStorages',
  suppliers: 'products:breadcrumbSuppliers',
}

export default function ProductsPage() {
  const { t } = useTranslation(['products', 'common'])
  // The catalogue is the screen; storages and suppliers are reached from the
  // bar above rather than from a tab strip, the same as resources on the
  // services page.
  const [view, setView] = useState('catalog')

  // Read once here rather than inside each screen. The product window's
  // consignment dropdown needs the suppliers while standing on the catalogue,
  // so a hook called inside the suppliers screen would be a list the catalogue
  // could not see — and calling it in both places would be two fetches of the
  // same four tables on one page.
  const directories = useInventoryDirectories()
  const { employees } = useEmployees()

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <ProductsSecondaryBar view={view} onSelect={setView} />

          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('products:breadcrumbProducts')}</span>
              {' / '}
              <span>{t(BREADCRUMB[view])}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            {view === 'catalog' && (
              <ProductsBrowser salonId={salonId} suppliers={directories.suppliers} />
            )}
            {view === 'storages' && (
              <StoragesManager
                storages={directories.storages}
                responsibles={directories.responsibles}
                employees={employees}
                loading={directories.loading}
                error={directories.error}
                reload={directories.reload}
                salonId={salonId}
              />
            )}
            {view === 'suppliers' && (
              <SuppliersManager
                suppliers={directories.suppliers}
                contacts={directories.contacts}
                loading={directories.loading}
                error={directories.error}
                reload={directories.reload}
                salonId={salonId}
              />
            )}
          </div>
        </AppShell>
      )}
    </AuthGate>
  )
}
