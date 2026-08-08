import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { BALANCE_STATE, emptyReason, EMPTY_REASON } from '../lib/balanceView'
import {
  sheetRows, lineReading, stocktakeSummary, countedRowsToSend,
  COUNT_STATE, countState, countUoms, defaultCountUom, droppedCounts,
} from '../lib/stocktakeSheet'
import { baseUnitsFor } from '../lib/stockDocument'
import { stocktakePayload } from '../lib/stockDocumentForm'
import { postStocktakeSession } from '../lib/stockIO'
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
  balances, products, categories, storageId, salonId, userId, loading, error, onPosted,
  stocktake,
}) {
  const {
    session, startedBy, startedAt, counts, uoms, setCounts, setUoms,
    writeError, writeCount, discard, clearAfterPost,
  } = stocktake
  const { t } = useTranslation(['products', 'common'])

  // ⚠️ THE STORAGE IS NOT THIS SCREEN'S ANY MORE — it comes from the module's
  // lens, and the page remounts this component when it changes (key={storageId}).
  // A remount is why there is no effect here clearing counts: an effect that
  // wipes state after a render is a second place the wipe can happen, and this
  // screen already had the wipe wired to its own select.
  const [categoryId, setCategoryId] = useState('')
  const [docDate, setDocDate] = useState(() => today())
  const [note, setNote] = useState('')

  // ⚠️ THE COUNTS DO NOT LIVE HERE ANY MORE, and the reason is a fault this
  // screen had all along rather than a preference.
  //
  // The page draws each tab as `{view === 'stocktake' && <StocktakeScreen/>}`,
  // so moving to another tab UNMOUNTS this component and React discards its
  // state. Somebody halfway through counting a shelf who stepped over to the
  // balances tab to check a figure came back to an empty sheet — silent,
  // plausible, permanent, with no question asked anywhere.
  //
  // ⚠️ And it made the storage-lens guard worse than useless: the page kept
  // its count of unsaved lines across the unmount, so changing storage after
  // stepping away asked "you will lose 3 lines" about work already gone.
  //
  // Lifted, the counts outlive both the tab and the remount, and the page
  // derives the pending total from the state it is now holding — so nothing
  // reports anything upward and there is no second copy to disagree.
  //
  // They are still the RAW strings, never numbers: the difference between ''
  // and '0' is the whole of COUNT_STATE, and Number() destroys it.

  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [posted, setPosted] = useState(null)

  // What is drawn: narrowed by the folder, because people count a shelf.
  const rows = useMemo(
    () => sheetRows({ balances, products, storageId, categoryId: categoryId || null, categories }),
    [balances, products, storageId, categoryId, categories]
  )

  // ⚠️ WHAT IS SENT: SCOPED BY WHAT WAS COUNTED, NEVER BY WHAT IS ON SCREEN.
  //
  // The folder is a way of walking the storage, not a boundary of the document.
  // Somebody counts the hair shelf, switches the filter to nails, counts that
  // too, and saves — and with the sending set narrowed to the visible rows, the
  // hair counts are discarded without a word. The confirmation says "1 line"
  // where they counted eight, and post_stocktake stores no counts (item 44), so
  // the work is gone with nothing to recover it from.
  //
  // Measured before it was fixed: two counts in, one sent, summary 1 not 2.
  //
  // ⚠️ And it is safe in the other reading too. Somebody who really is counting
  // only the nail shelf has only counted nail products, so "everything counted"
  // and "everything in this folder" are the same set for them. Sending what was
  // COUNTED is right whichever way the folder was being used.
  const countedScope = useMemo(
    () => sheetRows({ balances, products, storageId, categoryId: null, categories }),
    [balances, products, storageId, categories]
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
    for (const row of countedScope) {
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
  }, [countedScope, counts, uoms])

  // ⚠️ The summary describes the DOCUMENT, so it counts what will be sent and
  // not what is visible. That is also what makes the folder harmless: standing
  // in the nail folder, the total still says two lines counted, so nothing the
  // person did has quietly stopped existing.
  const summary = useMemo(() => stocktakeSummary(countedScope, readings), [countedScope, readings])

  const reason = emptyReason({ loading, error, products, rows })

  const quantity = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 3 })
  const money = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 2 })
  const unitOf = (product) => t(`products:units.${product.base_unit || 'pcs'}`)
  const nameOfCategory = (id) => (categories || []).find((c) => c.id === id)?.name || ''

  // ⚠️ WHICH ROWS ARE ON SCREEN, so the confirmation can say which of its lines
  // are NOT. Now that the folder
  // narrows the sheet and not the document, a counted row can be part of what
  // will be saved while being nowhere the person can look at it — and the box
  // that would clear it is in another folder. The confirmation is the one place
  // the whole document is visible, so it is where a line has to be removable.
  const onScreen = useMemo(
    () => new Set(rows.map((row) => row.product.id)),
    [rows]
  )

  // The box, as it is typed. Nothing reaches the database from here — the row
  // is written when the box loses focus.
  function setCount(productId, raw) {
    setCounts({ ...counts, [productId]: raw })
    setPosted(null)
  }

  // ⚠️ THE ONE PLACE A COUNT REACHES THE TABLE, and it takes the value from the
  // INPUT rather than from state. Reading `counts[id]` here would read whatever
  // the closure of the last render captured, and a paste followed immediately
  // by a tab-out can blur before that render has happened — writing the value
  // before last, which is a plausible count and therefore the worst kind of
  // wrong. The DOM node cannot be stale about its own value.
  function writeRow(product, raw) {
    writeCount({ salonId, product, raw, uom: uoms[product.id] })
  }

  // ⚠️ The number is NOT converted when the frame changes. "3" typed as
  // packages becoming "750" the moment somebody picks base units would be the
  // system editing what a person wrote down — and if they were switching frames
  // BECAUSE they mistyped, it destroys the correction they were about to make.
  // The reading underneath re-reads, which is where the change belongs.
  function setUom(productId, uom) {
    setUoms({ ...uoms, [productId]: uom })
    setPosted(null)
    // ⚠️ REWRITTEN IMMEDIATELY, and not on a later blur. The number stays as
    // typed and its MEANING changes — 3 packages and 3 units are different
    // counts of base units — so the stored row is wrong from this instant until
    // something rewrites it. A select has no blur to wait for.
    const product = (products || []).find((p) => p.id === productId)
    if (product) writeCount({ salonId, product, raw: counts[productId], uom })
  }

  async function save() {
    setSaving(true)
    setActionError('')

    // ⚠️ The second layer, and it fails closed. If the sending set and the
    // counts ever disagree again — a product archived out of the sheet mid
    // count, a filter that narrows something nobody expected — this stops
    // rather than shrinking the document in silence.
    const dropped = droppedCounts(countedScope, counts)
    if (dropped.length > 0) {
      setSaving(false)
      setActionError(t('products:stocktake.countsWouldBeLost', { count: dropped.length }))
      return
    }

    // ⚠️ THE PAYLOAD IS STILL BUILT, AND IT IS NO LONGER SENT. stocktakePayload
    // validates the date and every line — the whole-pieces rule, the frame a
    // product does not have, a count that is not a number — and none of that
    // moved into the database. Dropping it because the RPC no longer takes
    // lines would have deleted five refusals along with the argument they used
    // to travel in. What goes over the wire is the session id; what decides
    // whether it is worth sending is unchanged.
    const { error: buildError } = stocktakePayload({
      storageId,
      docDate,
      note,
      rows: countedRowsToSend(countedScope, counts, uoms),
    }, Object.fromEntries((products || []).map((p) => [p.id, p])))

    if (buildError) {
      setSaving(false)
      setActionError(t(buildError))
      return
    }

    // ⚠️ Nothing has been counted, so there is no session and nothing to post.
    // Reached only if the confirmation was opened on an empty sheet.
    if (!session) {
      setSaving(false)
      setActionError(t('products:stocktake.nothingCounted'))
      return
    }

    const { ok, error: rpcError } = await postStocktakeSession({
      sessionId: session.id, docDate, note,
    })
    setSaving(false)

    if (!ok) {
      setActionError(rpcError
        ? dbErrorSentence(rpcError, t, 'StocktakeScreen.post')
        : t('products:stock.noRowsError'))
      return
    }

    setConfirming(false)
    // ⚠️ The counted numbers were shown one last time here BECAUSE THE LEDGER
    // DID NOT KEEP THEM — post_stocktake stored the difference and the count
    // was gone the moment this screen forgot it (item 44). That is no longer
    // true: stocktake_counts holds every count, including the ones that matched,
    // and post_stocktake_session stamps the balance it was measured against.
    //
    // The summary stays anyway, and for a different reason: it is the receipt
    // for what was just sent. What it must not do now is imply the numbers are
    // about to be lost.
    setPosted({ countedLines: summary.countedLines, changed: summary.changing.length })
    // The rows belong to a document now; this sheet is over. Not a reload —
    // the session has a document_id, so re-reading would find nothing and the
    // round trip would only confirm what the RPC already returned.
    clearAfterPost()
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

  const countedRows = Object.values(counts).filter(
    (raw) => countState(raw) !== COUNT_STATE.UNTOUCHED
  ).length

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('products:stocktake.hint')}</p>

      {/* ⚠️ A BANNER AND NOT A DIALOG, because there is nothing to decide before
          counting can continue. The sheet already has the saved counts in it —
          resuming is what happens by default, so a modal would be a question
          whose answer is "yes, obviously" every time but one.

          The wording splits on whose count it is, which is the whole reason
          started_by exists: "your interrupted count" and "somebody else's open
          count" are different situations and only one of them is a surprise. */}
      {session && countedRows > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p>
            {t(startedBy && startedBy === userId
              ? 'products:stocktake.resumeYours'
              : 'products:stocktake.resumeOther',
            { when: startedAt ? String(startedAt).slice(0, 10) : '' })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('products:stocktake.resumeCounted', { count: countedRows })}
          </p>
          <Button
            type="button" variant="outline" size="sm" className="mt-2"
            onClick={() => setDiscarding(true)}
          >
            {t('products:stocktake.discardButton')}
          </Button>
        </div>
      )}

      {/* ⚠️ THE NUMBER IS IN THE QUESTION, not just in the button. Discarding an
          order destroys no work; discarding a count destroys an hour of
          somebody standing at a shelf, and "are you sure?" does not say that.
          It is also the one operation here the database will not undo — the
          rows go by cascade. */}
      {discarding && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">{t('products:stocktake.discardTitle')}</p>
          <p className="mt-1 text-muted-foreground">
            {t('products:stocktake.discardBody', { count: countedRows })}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button" variant="destructive" size="sm"
              onClick={async () => { setDiscarding(false); await discard() }}
            >
              {t('products:stocktake.discardConfirm')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDiscarding(false)}>
              {t('products:stocktake.discardCancel')}
            </Button>
          </div>
        </div>
      )}

      {/* ⚠️ SAID AT THE MOMENT IT HAPPENS, not held until the post. A count that
          did not reach the table is still on screen, looking exactly like one
          that did — and the person walks away believing it is safe. This is the
          only difference they can see between the two. */}
      {writeError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p>{t('products:stocktake.writeFailed')}</p>
          <p className="mt-1 text-muted-foreground">{dbErrorSentence(writeError, t, 'StocktakeScreen.write')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">

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
                              // ⚠️ ON BLUR, NOT ON EVERY KEYSTROKE. Typing 250
                              // would otherwise be four writes, three of them
                              // describing counts nobody made — and the third,
                              // "25", is a perfectly plausible count to leave
                              // behind if the connection drops on the fourth.
                              onBlur={(e) => writeRow(row.product, e.target.value)}
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
                    {/* Named only when it is somewhere else. A folder label on
                        every line is noise; on the lines you cannot see, it is
                        the address of the box that made them. */}
                    {!onScreen.has(row.product.id) && (
                      <Badge variant="outline">{nameOfCategory(row.product.category_id)}</Badge>
                    )}
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
                    {/* ⚠️ Emptying the box is what excludes a row — countState
                        reads '' as untouched, and untouched never becomes a
                        line. That worked already; what did not was REACHING the
                        box for a row in another folder. This is the same act,
                        from the one screen that shows the whole document. */}
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => setCount(row.product.id, '')}
                    >
                      {t('products:stocktake.dropLine')}
                    </Button>
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
