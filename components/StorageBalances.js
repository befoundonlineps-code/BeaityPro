import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, TrendingDown } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import {
  balanceRows, emptyReason, sortBalanceRows,
  BALANCE_STATE, COST_STATE, EMPTY_REASON,
} from '../lib/balanceView'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// What is on the shelf, per storage.
//
// ⚠️ Every decision about WHICH row appears lives in lib/balanceView.js, not
// here, because the stocktake reads the same rows and a second copy would
// drift. This file draws; that file decides.
//
// One storage at a time, never a sum across them. مبرد ومهدئ ليزر is -75 in the
// general storage and +75 in the test one — two storages both wrong, summing
// to a clean zero that says "no problem", which is the one meaning that must
// never be said here.
export default function StorageBalances({
  balances, products, storages, loading, error, reload,
}) {
  const { t } = useTranslation(['products', 'common'])
  const liveStorages = (storages || []).filter((s) => s.is_active !== false)
  const [storageId, setStorageId] = useState(() => (liveStorages[0] ? liveStorages[0].id : ''))

  const rows = sortBalanceRows(balanceRows({ balances, products, storageId }))
  const reason = emptyReason({ loading, error, products, rows })

  const money = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 2 })
  const quantity = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 3 })
  const unitOf = (product) => t(`products:units.${product.base_unit || 'pcs'}`)

  // Only rows with a real balance AND a real average contribute — a NULL
  // average is not zero, so a storage's value is the sum of what is known and
  // says nothing about what is not.
  const storageValue = rows
    .filter((r) => r.costState === COST_STATE.KNOWN || r.costState === COST_STATE.ZERO)
    .reduce((sum, r) => sum + r.balanceBase * r.avgCost, 0)

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('products:balances.hint')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="balance-storage">
          {t('products:balances.storageLabel')}
        </label>
        <select
          id="balance-storage"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
          value={storageId}
          onChange={(e) => setStorageId(e.target.value)}
        >
          {liveStorages.map((storage) => (
            <option key={storage.id} value={storage.id}>{storage.name}</option>
          ))}
        </select>

        {rows.length > 0 && (
          <Badge variant="secondary" className="ms-auto">
            {t('products:balances.totalValue', { total: money(storageValue) })}
          </Badge>
        )}
      </div>

      {/* ⚠️ THREE empty states, not one. A failed read is not emptiness — item
          26 — and "no products at all" versus "products but no movements" send
          a person to two entirely different actions. */}
      {reason === EMPTY_REASON.FAILED && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {t('products:balances.loadFailedTitle')}
          </span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'StorageBalances.load')}
          </span>
          <span className="w-full text-xs text-muted-foreground">
            {t('products:balances.loadFailedHint')}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      {reason === EMPTY_REASON.NO_PRODUCTS && (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          <span>{t('products:balances.emptyNoProductsTitle')}</span>
          <span className="text-xs">{t('products:balances.emptyNoProductsHint')}</span>
        </div>
      )}

      {reason === EMPTY_REASON.NO_STOCK && (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          <span>{t('products:balances.emptyNoStockTitle')}</span>
          <span className="text-xs">{t('products:balances.emptyNoStockHint')}</span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th className="py-2 text-start font-normal">{t('products:balances.columnProduct')}</th>
                <th className="py-2 text-start font-normal">{t('products:balances.columnBalance')}</th>
                <th className="py-2 text-start font-normal">{t('products:balances.columnCost')}</th>
                <th className="py-2 text-start font-normal">{t('products:balances.columnValue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.product.id}
                  data-product-id={row.product.id}
                  data-balance-state={row.balanceState}
                  data-cost-state={row.costState}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.product.name}</span>
                      {row.archived && (
                        <Badge variant="outline" title={t('products:balances.archivedHint')}>
                          {t('products:balances.archivedBadge')}
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="py-2">
                    {/* Never moved is NOT zero — the view has no row for it at
                        all, and "you have zero" is a sentence about a balance
                        that does not exist. */}
                    {row.balanceState === BALANCE_STATE.NEVER_MOVED ? (
                      <span className="text-muted-foreground" title={t('products:balances.neverMovedHint')}>
                        {t('products:balances.neverMoved')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>
                          {t('products:balances.inBase', {
                            unit: unitOf(row.product), n: quantity(row.balanceBase),
                          })}
                        </span>
                        {row.balanceState === BALANCE_STATE.NEGATIVE && (
                          <Badge variant="outline" title={t('products:balances.negativeHint')}>
                            {t('products:balances.negativeBadge')}
                          </Badge>
                        )}
                        {/* ⚠️ A SECOND, separate alarm: this one is about
                            QUANTITY. The one below is about VALUE. One badge
                            for both would rebuild what this module spent
                            itself taking apart. */}
                        {row.lowSupply && (
                          <Badge variant="secondary">
                            <TrendingDown className="size-3" />
                            {t('products:balances.lowSupplyBadge')}
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-2">
                    {/* NULL is not zero either: there is no average for a
                        balance of zero or less, which is neither "free" nor
                        "unknown". */}
                    {row.costState === COST_STATE.NONE ? (
                      <span className="text-muted-foreground" title={t('products:balances.noAverageHint')}>
                        {t('products:balances.noAverage')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>
                          {t('products:balances.unitCost', {
                            unit: unitOf(row.product), price: money(row.avgCost),
                          })}
                        </span>
                        {row.needsAttention && (
                          <Badge variant="destructive" title={t('products:balances.zeroCostHint')}>
                            <AlertTriangle className="size-3" />
                            {t('products:balances.zeroCostBadge')}
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-2 text-muted-foreground">
                    {row.costState === COST_STATE.NONE || row.balanceState === BALANCE_STATE.NEVER_MOVED
                      ? '—'
                      : money(row.balanceBase * row.avgCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
