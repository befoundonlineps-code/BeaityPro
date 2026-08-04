import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle } from 'lucide-react'
import TwoPaneBrowser from './TwoPaneBrowser'
import { buildProductTree } from '../lib/productTree'
import { treeContains } from '../lib/categoryTree'
import { isCategoryArchived } from '../lib/categoryVisibility'
import { indexCategoriesById } from '../lib/categoryTypes'
import { reportDbError } from '../lib/dbErrors'
import { useProductCatalog } from '../hooks/useProductCatalog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// The products screen, reading only.
//
// Same shape as the services screen and the same component underneath
// (TwoPaneBrowser), which is why the folder tree, the inherited archiving and
// the loading overlay of ADR-048 all work here without being written twice.
//
// Loading is passed down, never rendered instead of the browser — the rule
// ADR-048 exists for. There is no second screen to swap to here, so nothing
// gates the render at all.
export default function ProductsBrowser() {
  const { t } = useTranslation(['products', 'common'])
  const { categories, products, loading, error, reload } = useProductCatalog()

  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [search, setSearch] = useState('')

  // Off by default, and it hides rather than reveals — the inverse of the
  // reference's "Archive" box, deliberately.
  //
  // Archiving is undone from this screen and there is no delete button here at
  // all, so hiding archived rows by default would make the box the only route
  // back for anything taken out of circulation. lib/categoryVisibility.js
  // already writes the rule down: a folder you cannot see is a folder you
  // cannot restore. The services screen shows archived rows always; this now
  // matches it unless somebody deliberately asks for quiet, and when they do,
  // it applies to both panes rather than to one of them.
  const [hideArchived, setHideArchived] = useState(false)

  // The hiding rule is in lib/productTree.js, not spelled out here: it thins
  // the flat list before the walk so archiving stays inherited, and that is a
  // claim worth a test rather than a reading.
  const tree = useMemo(
    () => buildProductTree(categories, products, { hideArchived }),
    [categories, products, hideArchived]
  )
  const byId = useMemo(() => indexCategoriesById(categories), [categories])

  // A selection that survived the folder leaving the tree points at something
  // nobody can see: the right pane would keep listing its products while the
  // left pane shows nothing selected, and in step 3 the toolbar buttons would
  // edit and archive a folder that is not on screen. The same ADR-048 shape —
  // state naming what is no longer drawn — coming in through a filter.
  //
  // Derived rather than cleared. Hiding is a view filter, not a destructive
  // act, so unticking the box puts the person back where they were instead of
  // making them find the folder again. Nothing is written, so nothing can be
  // written wrongly.
  const visibleSelectedId = treeContains(tree, selectedCategoryId) ? selectedCategoryId : null

  const rows = useMemo(() => {
    if (!visibleSelectedId) return []
    const q = search.trim().toLowerCase()
    return (products || [])
      .filter((p) => p.category_id === visibleSelectedId)
      .filter((p) => !hideArchived || p.is_active !== false)
      .filter((p) => !q || (p.name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [products, visibleSelectedId, search, hideArchived])

  function selectCategory(id) {
    setSelectedCategoryId(id)
    setSelectedProductId(null)
  }

  const money = (value) =>
    value === null || value === undefined
      ? <span className="text-muted-foreground">—</span>
      : t('products:priceShort', { price: Number(value).toLocaleString('ar') })

  return (
    <>
      {/* Above the browser, never instead of it. Swapping the element out on
          failure is the ADR-048 mistake with a different trigger: a refresh
          that fails after somebody picked a folder would throw the folder,
          the open branches and the search away on its way to saying so. */}
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {t('products:loadFailedTitle')}
          </span>
          <span className="text-xs text-muted-foreground">
            {t(reportDbError(error, 'ProductsBrowser.load'))}
          </span>
          <span className="text-xs text-muted-foreground">{t('products:loadFailedHint')}</span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <TwoPaneBrowser
        loading={loading}
        tree={tree}
        isArchived={(root) => isCategoryArchived(root, byId)}
        archivedLabel={t('products:archivedBadge')}
        selectedCategoryId={visibleSelectedId}
        onSelectCategory={selectCategory}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('products:searchPlaceholder')}
        pickCategoryHint={t('products:pickCategoryHint')}
        // A catalogue that starts at zero folders needs to say so. The services
        // screen never did — it opened onto a seeded tree — so an empty white
        // pane here would read as a screen that failed to load.
        treeEmpty={
          <div className="flex flex-col gap-1 p-4 text-center text-sm text-muted-foreground">
            <span>{t('products:noCategoriesTitle')}</span>
            <span className="text-xs">{t('products:noCategoriesHint')}</span>
          </div>
        }
        itemsToolbar={
          <label className="flex cursor-pointer items-center gap-2 px-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={hideArchived}
              onChange={(e) => setHideArchived(e.target.checked)}
            />
            {t('products:hideArchived')}
          </label>
        }
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="w-24 px-3 py-2 text-start font-medium">{t('products:columns.abbreviation')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('products:columns.name')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.inContainer')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.purchasePrice')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.retailPrice')}</th>
            </tr>
          </thead>
          {/* No "Remaining" columns yet, in packages or in units. A balance is
              the sum of stock movements and there are none — so the honest
              answer today is "unknown", and a column of zeros would say
              "nothing left" instead. They arrive with the movements. */}
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`cursor-pointer border-b border-border/60 ${
                  selectedProductId === p.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                }`}
              >
                <td className="px-3 py-1.5 text-muted-foreground">{p.abbreviation || '—'}</td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className={p.is_active === false ? 'text-muted-foreground line-through' : ''}>
                      {p.name}
                    </span>
                    {p.kind === 'set' && <Badge variant="outline">{t('products:setBadge')}</Badge>}
                    {p.is_active === false && <Badge variant="outline">{t('products:archivedBadge')}</Badge>}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('products:inContainerValue', {
                    count: Number(p.units_per_package),
                    unit: t(`products:units.${p.base_unit}`),
                  })}
                </td>
                <td className="px-3 py-1.5">{money(p.nominal_purchase_price)}</td>
                <td className="px-3 py-1.5">{money(p.package_price)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {search.trim() ? t('common:noResults') : t('products:emptyCategory')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TwoPaneBrowser>
    </>
  )
}
