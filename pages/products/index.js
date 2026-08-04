import { useRouter } from 'next/router'
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
import { productsView, productsQuery, isDocumentView } from '../../lib/productsView'

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

export default function ProductsPage() {
  const { t } = useTranslation(['products', 'common'])
  const router = useRouter()

  // ⚠️ The tab lives in the URL, not in component state, and the owner found
  // out why the hard way. With it in state every tab was the same address, so
  // pressing "Products" in the main menu — which does router.push('/products')
  // — was a push to the page you were already on. Next sees no navigation and
  // does nothing, and somebody inside a sub-tab has no way back but the menu
  // that will not answer.
  //
  // Three more followed from the same cause and are fixed by the same line:
  // the browser's back button skipped the whole products section rather than
  // stepping between tabs, no tab could be bookmarked or sent to anybody, and
  // a reload dropped you on the catalogue — which was the very thing we were
  // telling people to do to work around the stale product list.
  //
  // Derived, never stored. The fallback for an unknown tab lives in
  // lib/productsView.js so it can be tested.
  const view = productsView(router.query.tab)

  function setView(next) {
    router.push(
      { pathname: '/products', query: productsQuery(next) },
      undefined,
      // The page's data is already loaded; this is a tab, not a fetch.
      { shallow: true }
    )
  }

  // Read once here rather than inside each screen. The product window's
  // consignment dropdown needs the suppliers while standing on the catalogue,
  // so a hook called inside the suppliers screen would be a list the catalogue
  // could not see — and calling it in both places would be two fetches of the
  // same four tables on one page.
  const directories = useInventoryDirectories()
  const { employees } = useEmployees()

  // ⚠️ One catalogue for the whole page, and this is the second bug the owner
  // found. ProductsBrowser used to call this hook itself, so the tab that
  // creates a product refreshed its own copy and the document screens kept
  // theirs — and the most ordinary path there is (goods arrive with a new item
  // → create the product → go and receive it) ended with the product missing
  // from the list. Worse than an inconvenience: somebody who cannot find what
  // they just made will look for a reason, and may make it again.
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
              <ProductsBrowser
                salonId={salonId}
                suppliers={directories.suppliers}
                catalogue={catalogue}
              />
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
            {isDocumentView(view) && (
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
