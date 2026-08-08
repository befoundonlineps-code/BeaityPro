import { useState } from 'react'
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
import StockDocumentsList from '../../components/StockDocumentsList'
import StorageBalances from '../../components/StorageBalances'
import StocktakeScreen from '../../components/StocktakeScreen'
import ProductOrderScreen from '../../components/ProductOrderScreen'
import { useInventoryDirectories } from '../../hooks/useInventoryDirectories'
import { useProductCatalog } from '../../hooks/useProductCatalog'
import { useEmployees } from '../../hooks/useEmployees'
import { useStockDocuments } from '../../hooks/useStockDocuments'
import { useProductBalances } from '../../hooks/useProductBalances'
import { useProductOrders } from '../../hooks/useProductOrders'
import { productsView, productsQuery, isDocumentView } from '../../lib/productsView'
import { currentLens, lensChoices, lensChangeCosts } from '../../lib/storageLens'
import { unsavedCounts } from '../../lib/stocktakeSheet'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'products', 'employees', 'settings', 'topBar'])),
    },
  }
}

// Which views are asking "where am I working". The catalogue, the storages
// manager and the suppliers list are not — they are about the salon, not about
// a place inside it, and a lens above them would be a control that does nothing.
const LENS_VIEWS = new Set(['stocktake', 'balances', 'documents'])
const usesLens = (view) => LENS_VIEWS.has(view) || isDocumentView(view)

const BREADCRUMB = {
  catalog: 'products:breadcrumbCatalog',
  storages: 'products:breadcrumbStorages',
  suppliers: 'products:breadcrumbSuppliers',
  orders: 'products:breadcrumbOrders',
  supply: 'products:breadcrumbSupply',
  write_off: 'products:breadcrumbWriteOff',
  return_to_supplier: 'products:breadcrumbReturn',
  transfer: 'products:breadcrumbTransfer',
  stocktake: 'products:breadcrumbStocktake',
  documents: 'products:breadcrumbDocuments',
  balances: 'products:breadcrumbBalances',
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
  // ⚠️ ONE ANSWER TO "WHICH STORAGE", for the whole module.
  //
  // Four screens each held their own, with three different defaults: the
  // document screens opened on nothing chosen, the stocktake and the balances
  // on the first live storage, and the document list on "all storages". Moving
  // between tabs lost the choice every time.
  const [chosenStorage, setChosenStorage] = useState('')

  // ⚠️ THE STOCKTAKE'S COUNTS LIVE HERE, not in the screen that draws them.
  //
  // Each tab is drawn as `{view === 'x' && <Screen/>}`, so leaving the tab
  // UNMOUNTS the screen and React discards its state. Somebody halfway
  // through counting who stepped over to the balances tab to check a figure
  // came back to an empty sheet, with nothing asked and nothing recoverable —
  // and post_stocktake stores no counts (item 44), so it is gone for good.
  //
  // ⚠️ It also made the lens guard below worse than useless: the pending total
  // was reported up and survived the unmount, so changing storage after
  // stepping away asked "you will lose 3 lines" about work already destroyed.
  //
  // Held here, the counts survive the tab and the remount, and the pending
  // total is DERIVED from them rather than reported — so there is no second
  // copy to fall out of step with the first.
  const [counts, setCounts] = useState({})
  const [uoms, setUoms] = useState({})
  const [pendingLens, setPendingLens] = useState(null)

  const catalogue = useProductCatalog()
  const stockDocuments = useStockDocuments()
  const balances = useProductBalances()
  // ⚠️ Read at the page and not inside the order screen, for the same reason
  // the catalogue is: the supply screen fills FROM these, so a hook called
  // inside the order tab would be a list the supply tab could not see — and
  // calling it in both places would be two reads of the same two tables.
  const productOrders = useProductOrders()

  const lensId = currentLens(directories.storages, chosenStorage)
  const pendingCounts = unsavedCounts(counts)

  function askLens(next) {
    if (next === lensId) return
    if (lensChangeCosts(pendingCounts)) { setPendingLens(next); return }
    setChosenStorage(next)
  }

  // ⚠️ The counts are dropped HERE, where the person just said to drop them.
  // A count belongs to the storage it was made in and cannot follow one, so
  // this is the only place in the module that throws counting away — and it
  // is one line after the sentence that asked.
  function confirmLens() {
    setChosenStorage(pendingLens)
    setCounts({})
    setUoms({})
    setPendingLens(null)
  }

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

            {/* ⚠️ NO "ALL STORAGES" HERE. Only the document list can mean it: a
                balance is per storage, post_stocktake takes one storage, and a
                supply enters one storage. A lens holding "all" would force those
                three to pick one silently — the implicit choice this module spends
                its rounds removing. The list keeps an explicit widening of its own,
                because its question is different: the lens says where I am working,
                the list asks what happened. */}
            {usesLens(view) && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('products:lens.label')}</span>
                <select
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  value={lensId}
                  onChange={(e) => askLens(e.target.value)}
                >
                  {lensChoices(directories.storages, lensId).length === 0 && (
                    <option value="">{t('products:docs.storageNone')}</option>
                  )}
                  {lensChoices(directories.storages, lensId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* The question, asked rather than answered for them: a count cannot
              move to another storage, so the only two outcomes are losing it or
              staying where it was made. */}
          {pendingLens !== null && (
            <div className="mx-5 mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p>{t('products:lens.pendingCounts', { count: pendingCounts })}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  onClick={confirmLens}
                >
                  {t('products:lens.discardAndSwitch')}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  onClick={() => setPendingLens(null)}
                >
                  {t('products:lens.stay')}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 p-5">
            {view === 'catalog' && (
              <ProductsBrowser
                salonId={salonId}
                suppliers={directories.suppliers}
                catalogue={catalogue}
                balances={balances.balances}
                storages={directories.storages}
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
            {view === 'orders' && (
              <ProductOrderScreen
                salonId={salonId}
                orders={productOrders.orders}
                lines={productOrders.lines}
                suppliers={directories.suppliers}
                products={catalogue.products}
                loading={productOrders.loading || catalogue.loading || directories.loading}
                error={productOrders.error || catalogue.error || directories.error}
                reload={productOrders.reload}
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
                storageId={lensId}
                storages={directories.storages}
                suppliers={directories.suppliers}
                products={catalogue.products}
                // For the duplicate-number warning: it looks for another
                // document of the same supplier carrying the same number.
                documents={stockDocuments.documents}
                // ⚠️ The supply is filled FROM these, so they are read at the
                // page and handed down — the same reason the catalogue is. A
                // hook inside the order tab would be a list this screen could
                // not see.
                orders={productOrders.orders}
                orderLines={productOrders.lines}
                loading={directories.loading || catalogue.loading}
                onPosted={() => { catalogue.reload(); stockDocuments.reload() }}
              />
            )}
            {view === 'stocktake' && (
              <StocktakeScreen
                // ⚠️ Keyed on the lens, so changing storage starts a fresh sheet by
                // REMOUNTING rather than by an effect clearing state after a render.
                // The counts belong to the storage they were made in and cannot
                // follow one; the question above has already been asked by the time
                // this key changes.
                key={lensId}
                storageId={lensId}
                counts={counts}
                onCountsChange={setCounts}
                uoms={uoms}
                onUomsChange={setUoms}
                balances={balances.balances}
                products={catalogue.products}
                categories={catalogue.categories}
                loading={balances.loading || catalogue.loading || directories.loading}
                // ⚠️ Either read failing fails the screen, and it matters more
                // here than anywhere: a counting sheet drawn from half a read
                // shows fewer products than exist, somebody counts what is in
                // front of them, and the products that never appeared are
                // untouched rather than wrong — so nothing looks amiss at all.
                error={balances.error || catalogue.error || directories.error}
                onPosted={() => { balances.reload(); stockDocuments.reload() }}
              />
            )}
            {view === 'documents' && (
              <StockDocumentsList
                // The list starts from the lens and can widen past it, which is the
                // one screen where "all storages" is a real question.
                storageId={lensId}
                documents={stockDocuments.documents}
                movements={stockDocuments.movements}
                products={catalogue.products}
                storages={directories.storages}
                suppliers={directories.suppliers}
                loading={stockDocuments.loading || catalogue.loading}
                error={stockDocuments.error}
                reload={stockDocuments.reload}
              />
            )}
            {view === 'balances' && (
              <StorageBalances
                storageId={lensId}
                balances={balances.balances}
                products={catalogue.products}
                storages={directories.storages}
                loading={balances.loading || catalogue.loading || directories.loading}
                // ⚠️ Either read failing fails the screen. A balance list is
                // legitimately empty on a fresh salon, so half a read drawn as
                // "no stock recorded" would reassure rather than fail — item 26,
                // which this hook had to earn again because it is new.
                error={balances.error || catalogue.error || directories.error}
                reload={() => { balances.reload(); catalogue.reload() }}
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
