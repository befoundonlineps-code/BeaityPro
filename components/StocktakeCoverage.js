import { useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import {
  coverageByStocktake, coverageByProduct, coverageTotals,
} from '../lib/stocktakeCoverage'
import { Button } from '@/components/ui/button'

// The stocktake as a period report.
//
// ⚠️ EVERY NUMBER HERE WAS UNANSWERABLE UNTIL 054a. The old post_stocktake
// skipped a product whose count matched, so "counted and correct" and "never
// counted" were the same absence. This screen exists because that stopped being
// true, and the column it exists FOR is `matched` — the one nobody could draw.
//
// Two tables, and the second is the one that matters. A list of stocktakes is
// reassuring by construction: every row is evidence somebody counted something.
// The catalogue view is where the finding lives, because it draws the products
// that appear in NO stocktake, and nothing else on this screen can show them.
export default function StocktakeCoverage({
  sessions, counts, documents, products, storages, loading, error, reload,
}) {
  const { t } = useTranslation(['products', 'common'])
  const [showCounted, setShowCounted] = useState(false)

  const byStocktake = useMemo(
    () => coverageByStocktake({ sessions, counts, documents }),
    [sessions, counts, documents]
  )
  const byProduct = useMemo(
    () => coverageByProduct({ products, sessions, counts, documents }),
    [products, sessions, counts, documents]
  )
  const totals = useMemo(() => coverageTotals(byProduct), [byProduct])

  const storageName = (id) => (storages || []).find((s) => s.id === id)?.name || '—'

  // ⚠️ The never-counted first, always. Sorting by name would bury the finding
  // among the reassurance, and somebody scrolling a long list stops before the
  // part they needed. The toggle hides the counted rows rather than reordering
  // them, so the default view IS the finding.
  const productRows = useMemo(() => {
    const rows = showCounted ? byProduct : byProduct.filter((r) => r.times === 0)
    return [...rows].sort((a, b) => {
      if ((a.times === 0) !== (b.times === 0)) return a.times === 0 ? -1 : 1
      return String(a.product.name || '').localeCompare(String(b.product.name || ''), 'ar')
    })
  }, [byProduct, showCounted])

  if (loading) return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-medium">{t('products:coverage.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t, 'StocktakeCoverage')}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={reload}>
          {t('products:retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">{t('products:coverage.title')}</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t('products:coverage.hint')}</p>
      </div>

      {/* The one number somebody wants first, and its counterpart beside it
          rather than left to subtraction. */}
      <div className="flex flex-wrap gap-3">
        <Figure label={t('products:coverage.totalProducts')} value={totals.products} />
        <Figure label={t('products:coverage.totalCounted')} value={totals.counted} />
        <Figure label={t('products:coverage.totalNever')} value={totals.never} alarming={totals.never > 0} />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t('products:coverage.byStocktakeTitle')}</h3>
        {byStocktake.length === 0 ? (
          <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            {t('products:coverage.noStocktakes')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2 text-start">{t('products:coverage.colDate')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colStorage')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colCounted')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colMatched')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colDiffered')}</th>
                </tr>
              </thead>
              <tbody>
                {byStocktake.map((row) => (
                  <tr key={row.session.id} className="border-b border-border/60">
                    <td className="p-2">{String(row.docDate).slice(0, 10)}</td>
                    <td className="p-2">{storageName(row.storageId)}</td>
                    <td className="p-2">{row.counted}</td>
                    {/* ⚠️ THE COLUMN THIS SCREEN EXISTS FOR. Before 054a a
                        matching product left no row at all, so this number was
                        not small — it was unobtainable. */}
                    <td className="p-2">{row.matched}</td>
                    <td className="p-2">{row.differed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t('products:coverage.byProductTitle')}</h3>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showCounted}
              onChange={(e) => setShowCounted(e.target.checked)}
            />
            {t('products:coverage.showCounted')}
          </label>
        </div>

        {productRows.length === 0 ? (
          <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
            {t(showCounted ? 'products:coverage.noProducts' : 'products:coverage.allCounted')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2 text-start">{t('products:coverage.colProduct')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colLastCounted')}</th>
                  <th className="p-2 text-start">{t('products:coverage.colTimes')}</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((row) => (
                  <tr key={row.product.id} className="border-b border-border/60">
                    <td className="p-2">
                      {row.product.name}
                      {row.product.is_active === false && (
                        <span className="ms-2 text-xs text-muted-foreground">
                          {t('products:archivedBadge')}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {row.lastCounted ? String(row.lastCounted).slice(0, 10) : (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="size-3.5" />
                          {t('products:coverage.neverCounted')}
                        </span>
                      )}
                    </td>
                    <td className="p-2">{row.times}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Figure({ label, value, alarming }) {
  return (
    <div className={`rounded-lg border p-3 ${alarming ? 'border-destructive/40 bg-destructive/10' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}
