import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ProductsBrowser from '../../components/ProductsBrowser'
import ProductsSecondaryBar from '../../components/ProductsSecondaryBar'
import StoragesManager from '../../components/StoragesManager'
import SuppliersManager from '../../components/SuppliersManager'
import StockDocumentScreen from '../../components/StockDocumentScreen'
import { useInventoryDirectories } from '../../hooks/useInventoryDirectories'
import { useProductCatalog } from '../../hooks/useProductCatalog'
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
  supply: 'products:breadcrumbSupply',
  write_off: 'products:breadcrumbWriteOff',
  return_to_supplier: 'products:breadcrumbReturn',
  transfer: 'products:breadcrumbTransfer',
}

// The four views that are one screen with a doc type, rather than four screens.
const DOCUMENT_VIEWS = ['supply', 'write_off', 'return_to_supplier', 'transfer']

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
  // The supply screen needs the products, and so does the catalogue below it.
  // ProductsBrowser keeps its own copy for now rather than being rewired in the
  // same step that adds a document — one change at a time.
  const catalogue = useProductCatalog()

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
            {DOCUMENT_VIEWS.includes(view) && (
              <StockDocumentScreen
                // Keyed on the doc type so switching documents starts a fresh
                // form. Without it React keeps the old state under the new
                // shape, and a supplier picked for a return would still be
                // sitting there on a write-off that has no supplier field.
                key={view}
                docType={view}
                storages={directories.storages}
                suppliers={directories.suppliers}
                products={catalogue.products}
                loading={directories.loading || catalogue.loading}
                onPosted={catalogue.reload}
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
