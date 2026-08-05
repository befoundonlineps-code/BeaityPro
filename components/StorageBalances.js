import { Fragment, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, TrendingDown } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import {
  balanceRows, emptyReason, sortBalanceRows, storageValueSummary,
  problemKind, counterpartBalances,
  BALANCE_STATE, COST_STATE, EMPTY_REASON, PROBLEM_KIND,
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
  const nameOfStorage = (id) => (storages || []).find((s) => s.id === id)?.name || '—'

  // ⚠️ Two kinds of "wrong", separated on the page rather than merged into one
  // rank. A record that is incomplete or impossible is fixed by correcting a
  // document; a low shelf is fixed by ordering. Different act, different
  // person, different urgency — and one rank makes somebody read all three
  // with one eye.
  const GROUP_LABEL = {
    [PROBLEM_KIND.DATA]: 'products:balances.groupData',
    [PROBLEM_KIND.OPERATIONAL]: 'products:balances.groupOperational',
    [PROBLEM_KIND.NONE]: 'products:balances.groupRest',
  }

  // ⚠️ The total holds out stock recorded at zero cost AND says how much it
  // held out. The first version summed "what is known", which excluded NULL
  // because it could and kept the zeros because it could not — so a line said
  // "its value is unknown" while the total counted it as nothing. Arithmetic
  // does not read badges.
  const { total, unvaluedProducts } = storageValueSummary(rows)

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
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {t('products:balances.totalValue', { total: money(total) })}
            </Badge>
            {/* ⚠️ A total that excludes something says what it excluded.
                Excluding it silently would produce a figure smaller than the
                truth with nobody able to ask why — the fault we keep removing.
                The rule holds for every total after this one. */}
            {unvaluedProducts > 0 && (
              <Badge variant="outline" title={t('products:balances.unvaluedHint')}>
                {/* ⚠️ A COUNT OF PRODUCTS, never a summed quantity. My first
                    version added the held-out balances together — and those
                    are each in their own product's base unit, so pieces and
                    millilitres would have gone into one figure. That is the
                    rule enforced on every other screen, broken inside the
                    function written to make a total honest. A count has no
                    unit and is always true. */}
                {t('products:balances.unvalued', { n: unvaluedProducts })}
              </Badge>
            )}
          </div>
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
              {rows.map((row, index) => (
                <Fragment key={row.product.id}>
                  {/* The kind changes here, so the page says so. */}
                  {(index === 0 || problemKind(rows[index - 1]) !== problemKind(row)) && (
                    <tr data-group={problemKind(row)}>
                      <td colSpan={4} className="pt-4 pb-1 text-xs text-muted-foreground">
                        {t(GROUP_LABEL[problemKind(row)])}
                      </td>
                    </tr>
                  )}
                <tr
                  data-product-id={row.product.id}
                  data-balance-state={row.balanceState}
                  data-cost-state={row.costState}
                  data-problem-kind={problemKind(row)}
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
                        {/* ⚠️ Where the other half is. The commonest cause of a
                            negative balance is a transfer recorded before the
                            supply, so the counterpart is the most useful
                            context this row can carry — and the -75 here has a
                            +75 sitting in another storage that this screen
                            already has in hand. */}
                        {row.balanceState === BALANCE_STATE.NEGATIVE
                          && counterpartBalances({ balances, productId: row.product.id, storageId })
                            .map((other) => (
                              <span key={other.storage_id} className="text-xs text-muted-foreground">
                                {t('products:balances.counterpart', {
                                  n: quantity(other.balance_base),
                                  storage: nameOfStorage(other.storage_id),
                                })}
                              </span>
                            ))}
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
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
