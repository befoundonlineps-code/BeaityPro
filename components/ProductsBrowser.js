import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import TwoPaneBrowser from './TwoPaneBrowser'
import { buildProductTree } from '../lib/productTree'
import { isCategoryArchived } from '../lib/categoryVisibility'
import { indexCategoriesById } from '../lib/categoryTypes'
import { useProductCatalog } from '../hooks/useProductCatalog'
import { Badge } from '@/components/ui/badge'

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
  const { categories, products, loading } = useProductCatalog()

  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const tree = useMemo(() => buildProductTree(categories, products), [categories, products])
  const byId = useMemo(() => indexCategoriesById(categories), [categories])

  const rows = useMemo(() => {
    if (!selectedCategoryId) return []
    const q = search.trim().toLowerCase()
    return (products || [])
      .filter((p) => p.category_id === selectedCategoryId)
      .filter((p) => showArchived || p.is_active !== false)
      .filter((p) => !q || (p.name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [products, selectedCategoryId, search, showArchived])

  function selectCategory(id) {
    setSelectedCategoryId(id)
    setSelectedProductId(null)
  }

  const money = (value) =>
    value === null || value === undefined
      ? <span className="text-muted-foreground">—</span>
      : t('products:priceShort', { price: Number(value).toLocaleString('ar') })

  return (
    <TwoPaneBrowser
      loading={loading}
      tree={tree}
      isArchived={(root) => isCategoryArchived(root, byId)}
      archivedLabel={t('products:archivedBadge')}
      selectedCategoryId={selectedCategoryId}
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
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t('products:showArchived')}
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
  )
}
