import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { BALANCE_STATE, emptyReason, EMPTY_REASON } from '../lib/balanceView'
import {
  sheetRows, lineReading, stocktakeSummary, countedRowsToSend,
  COUNT_STATE, countState, countUoms, defaultCountUom,
} from '../lib/stocktakeSheet'
import { baseUnitsFor } from '../lib/stockDocument'
import { stocktakePayload } from '../lib/stockDocumentForm'
import { postStocktake } from '../lib/stockIO'
import { today, maxDocumentDate } from '../lib/documentDate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// The counting sheet.
//
// ⚠️ Every decision about WHICH line appears and WHAT IT MEANS lives in
// lib/stocktakeSheet.js and lib/balanceView.js. This file draws. The one thing
// it must never do is derive "recorded" for itself: an adjustment written from
// a wrong recorded figure looks exactly like an ordinary correction, and is the
// one this module cannot detect afterwards.
export default function StocktakeScreen({
  balances, products, categories, storages, loading, error, onPosted,
}) {
  const { t } = useTranslation(['products', 'common'])

  const liveStorages = (storages || []).filter((s) => s.is_active !== false)
  const [storageId, setStorageId] = useState(() => (liveStorages[0] ? liveStorages[0].id : ''))
  const [categoryId, setCategoryId] = useState('')
  const [docDate, setDocDate] = useState(() => today())
  const [note, setNote] = useState('')

  // Keyed by product id, and holding the RAW string — never a number. The
  // difference between '' and '0' is the whole of COUNT_STATE, and Number()
  // destroys it.
  const [counts, setCounts] = useState({})

  // The frame each row is being counted in, keyed the same way. Empty means
  // "whatever this product opens with" — held rather than pre-filled, so a
  // product arriving from a reload is framed by the rule and not by a stale map.
  const [uoms, setUoms] = useState({})

  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [posted, setPosted] = useState(null)

  const rows = useMemo(
    () => sheetRows({ balances, products, storageId, categoryId: categoryId || null, categories }),
    [balances, products, storageId, categoryId, categories]
  )

  // ⚠️ THE FRAME IS THE COUNTER'S, PER ROW — it used to be base units for every
  // product on the sheet. The unit was named beside the box, so nobody was
  // misled, and that is exactly why it survived: it broke no rule about
  // labelling while breaking item 35, which says the multiplication belongs to
  // the system. Counting three 250ml tubes meant typing 750, worked out in
  // somebody's head while standing at a shelf.
  //
  // Packages by default where a package holds more than one, and the other
  // frames stay per row for the open tube — the case that makes ONE fixed frame
  // wrong rather than merely awkward, because no number of packages says
  // "100ml left".
  const uomOf = (product) => uoms[product.id] || defaultCountUom(product)

  // ⚠️ THE CONVERSION HAPPENS ONCE, HERE, and by the same function the line
  // builder uses. The count is typed in the counter's frame and everything
  // downstream — recorded, difference, value — is in base units, so exactly one
  // multiplication stands between them. A second copy of it is a second answer
  // to "how many base units is a package", and this module has already paid for
  // one of those.
  const readings = useMemo(() => {
    const map = {}
    for (const row of rows) {
      const raw = counts[row.product.id]
      const state = countState(raw)
      // ⚠️ Reads `uoms` directly rather than calling uomOf, and the repetition
      // is the point. uomOf is defined in the component body, so a memo calling
      // it depends on a function rebuilt every render — exhaustive-deps says so
      // and the ratchet caught it the moment this was "tidied" into a helper
      // call. The rule itself is not duplicated; it lives in defaultCountUom.
      const factor = baseUnitsFor(row.product, uoms[row.product.id] || defaultCountUom(row.product))
      map[row.product.id] = lineReading(
        row, raw, state === COUNT_STATE.UNTOUCHED ? null : Number(raw) * (factor || 1)
      )
    }
    return map
  }, [rows, counts, uoms])

  const summary = useMemo(() => stocktakeSummary(rows, readings), [rows, readings])

  const reason = emptyReason({ loading, error, products, rows })

  const quantity = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 3 })
  const money = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 2 })
  const unitOf = (product) => t(`products:units.${product.base_unit || 'pcs'}`)
  const nameOfCategory = (id) => (categories || []).find((c) => c.id === id)?.name || ''

  function setCount(productId, raw) {
    setCounts((current) => ({ ...current, [productId]: raw }))
    setPosted(null)
  }

  // ⚠️ The number is NOT converted when the frame changes. "3" typed as
  // packages becoming "750" the moment somebody picks base units would be the
  // system editing what a person wrote down — and if they were switching frames
  // BECAUSE they mistyped, it destroys the correction they were about to make.
  // The reading underneath re-reads, which is where the change belongs.
  function setUom(productId, uom) {
    setUoms((current) => ({ ...current, [productId]: uom }))
    setPosted(null)
  }

  async function save() {
    setSaving(true)
    setActionError('')

    const { payload, error: buildError } = stocktakePayload({
      storageId,
      docDate,
      note,
      rows: countedRowsToSend(rows, counts, uoms),
    }, Object.fromEntries((products || []).map((p) => [p.id, p])))

    if (buildError) {
      setSaving(false)
      setActionError(t(buildError))
      return
    }

    const { ok, error: rpcError } = await postStocktake(payload)
    setSaving(false)

    if (!ok) {
      setActionError(rpcError
        ? dbErrorSentence(rpcError, t, 'StocktakeScreen.post')
        : t('products:stock.noRowsError'))
      return
    }

    setConfirming(false)
    // ⚠️ The counted numbers are shown one last time here, because the ledger
    // does not keep them: post_stocktake stores the DIFFERENCE and the count is
    // gone the moment this screen forgets it (item 44). Clearing the fields
    // without saying so would make the numbers vanish silently.
    setPosted({ countedLines: summary.countedLines, changed: summary.changing.length })
    setCounts({})
    // The frames go with the counts: they described a sheet that has been sent.
    setUoms({})
    if (onPosted) onPosted()
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  // ⚠️ Three empty states, never one. A failed read drawn as "nothing here"
  // reassures instead of failing (item 26), and "no products" and "no storage"
  // send a person to two different screens.
  if (reason === EMPTY_REASON.FAILED) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        {dbErrorSentence(error, t, 'StocktakeScreen.load')}
      </div>
    )
  }

  let lastCategory = null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('products:stocktake.hint')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('products:docs.storageLabel')}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={storageId}
            onChange={(e) => { setStorageId(e.target.value); setCounts({}); setUoms({}); setPosted(null) }}
          >
            {liveStorages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        {/* ⚠️ Size is solved here and not by hiding rows. People count a shelf,
            not a warehouse — a folder cuts the sheet along the real world,
            while "hide what has no balance" cuts it against the real world and
            removes exactly the lines a stocktake exists to find. */}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('products:stocktake.folderLabel')}</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t('products:stocktake.folderAll')}</option>
            {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('products:docs.dateLabel')}</span>
          <Input type="date" className="w-40" value={docDate} max={maxDocumentDate()}
            onChange={(e) => { setDocDate(e.target.value); setPosted(null) }} />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('products:docs.noteLabel')}</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      {reason === EMPTY_REASON.NO_PRODUCTS && (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          {t('products:stocktake.emptyNoProducts')}
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right">
              <tr>
                <th className="px-3 py-2 font-medium">{t('products:stocktake.colProduct')}</th>
                <th className="px-3 py-2 font-medium">{t('products:stocktake.colRecorded')}</th>
                <th className="px-3 py-2 font-medium">{t('products:stocktake.colCounted')}</th>
                <th className="px-3 py-2 font-medium">{t('products:stocktake.colDifference')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const reading = readings[row.product.id]
                const showHeading = row.product.category_id !== lastCategory
                lastCategory = row.product.category_id
                return (
                  <Fragment key={row.product.id}>
                    {showHeading && (
                      <tr className="bg-muted/30">
                        <td colSpan={4} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          {nameOfCategory(row.product.category_id)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.product.name}</span>
                          {row.archived && (
                            <Badge variant="outline">{t('products:stocktake.archivedBadge')}</Badge>
                          )}
                        </div>
                      </td>

                      {/* ⚠️ THREE STATES, three different sentences. "Never
                          recorded" is not "0": one shelf was never stocked and
                          the other was emptied, and a counter who reads the
                          first as the second stops looking for goods that are
                          standing right there. */}
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.balanceState === BALANCE_STATE.NEVER_MOVED
                          ? t('products:stocktake.recordedNever')
                          : `${unitOf(row.product)}: ${quantity(row.balanceBase)}`}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-24"
                              inputMode="decimal"
                              value={counts[row.product.id] ?? ''}
                              onChange={(e) => setCount(row.product.id, e.target.value)}
                              placeholder={t('products:stocktake.notCounted')}
                            />
                            {/* One frame is not a choice. A product whose
                                package holds one unit has nothing to pick
                                between, and a select with a single option is a
                                control that teaches people to ignore selects. */}
                            {countUoms(row.product).length > 1 ? (
                              <select
                                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                value={uomOf(row.product)}
                                onChange={(e) => setUom(row.product.id, e.target.value)}
                              >
                                {countUoms(row.product).map((uom) => (
                                  <option key={uom} value={uom}>{t(`products:docs.uom_${uom}`)}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-muted-foreground">{unitOf(row.product)}</span>
                            )}
                          </div>

                          {/* ⚠️ BOTH FRAMES, once they are two numbers. The
                              recorded column and the difference are in base
                              units and this box is not, so a sheet showing only
                              what was typed would put 3 beside a difference of
                              −250 with nothing connecting them. This is the
                              rule the owner's own «أدخل ٥ والصفّ بيقول ٧٥»
                              produced, applied to the count. */}
                          {reading.countedBase !== null
                            && reading.countedBase !== Number(counts[row.product.id]) && (
                            <span className="text-[11px] text-muted-foreground">
                              {`${unitOf(row.product)}: ${quantity(reading.countedBase)}`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        {reading.state === COUNT_STATE.UNTOUCHED ? (
                          // ⚠️ Not a zero. "Nothing counted yet" and "counted,
                          // and it matched" are opposite findings and only one
                          // of them is a result.
                          <span className="text-muted-foreground">—</span>
                        ) : reading.difference === 0 ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="size-4" />
                            {t('products:stocktake.matches')}
                          </span>
                        ) : (
                          <span className={reading.difference > 0 ? 'text-emerald-600' : 'text-destructive'}>
                            {quantity(reading.difference)}
                          </span>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {posted && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          {t('products:stocktake.postedNotice', {
            counted: posted.countedLines, changed: posted.changed,
          })}
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          {actionError}
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            {t('products:stocktake.progress', {
              counted: summary.countedLines, total: rows.length,
            })}
          </div>
          <Button disabled={summary.countedLines === 0 || saving} onClick={() => setConfirming(true)}>
            {t('products:stocktake.review')}
          </Button>
        </div>
      )}

      {/* ⚠️ The confirmation names the VALUE and lists the lines that will
          move — not the lines that were counted. Somebody agreeing to "save
          the stocktake" is agreeing to those movements, and a count of fifty
          with three differences is three movements. */}
      {confirming && (
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          <p className="font-medium">{t('products:stocktake.confirmTitle')}</p>

          {summary.changing.length === 0 ? (
            // ⚠️ Item 44: a stocktake where everything matched writes no
            // movements at all — and that is a result worth recording with its
            // date, not an error. Said in words, because an empty list looks
            // identical to a failure.
            <p className="mt-2 text-muted-foreground">
              {t('products:stocktake.confirmNothingChanges', { counted: summary.countedLines })}
            </p>
          ) : (
            <>
              <ul className="mt-2 flex flex-col gap-1">
                {summary.changing.map(({ row, reading, value }) => (
                  <li key={row.product.id} className="flex flex-wrap items-center gap-2">
                    <span>{row.product.name}</span>
                    <span className="text-muted-foreground">
                      {t('products:stocktake.confirmLine', {
                        recorded: quantity(reading.recorded),
                        counted: quantity(reading.countedBase),
                        difference: quantity(reading.difference),
                        unit: unitOf(row.product),
                      })}
                    </span>
                    {value === null
                      ? <Badge variant="outline">{t('products:stocktake.valueUnknown')}</Badge>
                      : <span className="text-muted-foreground">{money(value)} ₪</span>}
                  </li>
                ))}
              </ul>

              <p className="mt-3">
                {t('products:stocktake.confirmValue', { total: money(summary.valued) })}
              </p>
              {/* ⚠️ A total that excludes something says what it excluded. The
                  price of an adjustment is decided inside post_stocktake by the
                  fallback chain, so a line with no recorded average cannot be
                  valued here — and a surplus of something never stocked is the
                  commonest such line there is. */}
              {summary.unvaluedLines > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {t('products:stocktake.confirmUnvalued', { count: summary.unvaluedLines })}
                </p>
              )}
            </>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>{t('products:stocktake.confirmSave')}</Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
              {t('common:cancel')}
            </Button>
          </div>
        </div>
      )}

      {summary.untouchedLines > 0 && summary.countedLines > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {/* An untouched row is never sent, so a partial count is a partial
              stocktake and nothing else — said plainly rather than left to be
              assumed either way. */}
          {t('products:stocktake.partialNotice', { count: summary.untouchedLines })}
        </p>
      )}
    </div>
  )
}
