import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Undo2, ChevronDown, ChevronLeft } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { reverseStockDocument } from '../lib/stockIO'
import {
  EMPTY_FILTERS, filterDocuments, supplierFilterApplies, filterEmptyReason, FILTER_EMPTY,
} from '../lib/documentFilters'
import {
  sortDocuments, movementsOf, movementFrames, reversalState,
  documentProductNames, documentDate, costFrames, documentValue, documentValueLabel,
} from '../lib/stockDocumentList'
import { RECEIPT_TYPES, ISSUE_TYPES, OWN_FUNCTION } from '../lib/stockDocument'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// The types the filter offers. Derived from the two lists that already decide
// what a document can be, plus the three with their own functions — rather
// than a fourth hand-typed list that drifts from them.
const DOC_TYPE_OPTIONS = [...RECEIPT_TYPES, ...ISSUE_TYPES, ...OWN_FUNCTION]

// The documents that have been posted, newest first, and one thing to do with
// them: undo one.
//
// ⚠️ This is a condition of the module being usable, not a convenience. Without
// it a document posted wrongly is permanent and invisible, and somebody who
// cannot correct a mistake works around it — a fake issue to cancel it out,
// which corrupts the ledger, or a hand-edited row, which corrupts the principle
// the whole module rests on. Two documents were already posted with a zero cost
// before the screen that could undo them existed.
//
// Narrow on purpose: no paging, no filters, no search. Those arrive when the
// number of documents asks for them. Reversal was needed with the first wrong
// one.
export default function StockDocumentsList({
  documents, movements, products, storages, suppliers, loading, error, reload,
}) {
  const { t } = useTranslation(['products', 'common'])
  const [expanded, setExpanded] = useState(() => new Set())
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  // ⚠️ NARROWED HERE, IN MEMORY — never in the query, and this is a safety
  // property rather than a preference. reversalState below is handed
  // `documents` (the whole loaded set) and not `rows`: a reversal filtered out
  // of the view must still answer "was this reversed?". Filtering in the query
  // would drop it from both, the button would light up on an already-reversed
  // document, and the database would refuse with a sentence this screen never
  // expected. Measured in lib/documentFilters.test.js.
  const rows = sortDocuments(filterDocuments(documents, filters))
  const emptyKind = filterEmptyReason({ documents, filtered: rows, filters })
  const supplierUsable = supplierFilterApplies(filters.docType)
  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || '—'

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmReverse() {
    if (!confirming) return
    setBusy(true)
    setActionError('')
    const { ok, error: rpcError } = await reverseStockDocument({ documentId: confirming.id })
    setBusy(false)
    if (!ok) {
      setActionError(rpcError
        // ⚠️ 23505 here has one meaning and it is not "that already exists".
        // reverse_stock_document checks already_reversed BEFORE it takes its
        // lock, so two attempts at once both read "not reversed" — and the
        // unique index on reverses_document_id is what stops the second from
        // doubling the correction (item 51). Whoever sees this did nothing
        // wrong and has no data to review: the document was reversed a moment
        // ago somewhere else, and reloading shows it.
        ? dbErrorSentence(rpcError, t, 'StockDocumentsList.reverse', {
          23505: 'products:stock.reversedElsewhere',
        })
        : t('products:stock.noRowsError'))
      return
    }
    setConfirming(null)
    reload()
  }

  // ⚠️ Unit first, number second — every quantity, everywhere.
  //
  // "5 عبوات" versus "5 عبوة" is a grammar branch we refuse to have, so the
  // number never governs the word after it (CLAUDE.md). And both frames are
  // shown because neither alone is honest: the person who typed 5 does not
  // recognise 75, and 5 cannot be added to a line entered in pieces.
  function quantityText(movement) {
    const product = productsById[movement.product_id]
    const f = movementFrames(movement, product)
    const baseText = t('products:documents.inBase', {
      unit: t(`products:units.${f.baseUnit || 'pcs'}`),
      n: f.base,
    })
    if (f.entered === null || f.sameFrame) return baseText
    return `${t('products:documents.inEntered', {
      uom: t(`products:docs.uom_${f.uom}`), n: f.entered,
    })} · ${baseText}`
  }

  // ⚠️ The same rule as quantityText, on the other half of the line — the rule
  // is about every NUMBER, not every quantity. "تكلفة الوحدة: 100 ₪" named no
  // unit while the quantity two centimetres away named both, and unit_cost is
  // per BASE unit, so on a product of 15 per package the figure is 6.6667 and
  // not the 100 somebody typed.
  //
  // The unit is named and nothing is derived — see costFrames for why the
  // typed price is not reconstructed here.
  function costText(movement) {
    const c = costFrames(movement, productsById[movement.product_id])
    if (!c) return null
    return t('products:documents.unitCost', {
      unit: t(`products:units.${c.baseUnit || 'pcs'}`),
      price: c.base.toLocaleString('ar', { maximumFractionDigits: 4 }),
    })
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t('products:loadFailedTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'StockDocumentsList.load')}
          </span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t('products:documents.hint')}</p>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {/* ⚠️ The supplier control is DISABLED for a type that cannot have one,
          not silently ignored. A filter that is ignored is a filter that lies:
          it shows rows that do not match what was asked and nothing says so.
          Same language the reference uses when it dims the document buttons
          under «all storages». */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterFrom')}
          <input type="date" className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterTo')}
          <input type="date" className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterType')}
          <select className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.docType} onChange={(e) => setFilter('docType', e.target.value)}>
            <option value="">{t('products:documents.filterAll')}</option>
            {DOC_TYPE_OPTIONS.map((k) => (
              <option key={k} value={k}>{t(`products:docs.${k}.title`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterNumber')}
          <input className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'} value={filters.docNumber}
            onChange={(e) => setFilter('docNumber', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterSupplier')}
          <select className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'} disabled={!supplierUsable}
            title={supplierUsable ? undefined : t('products:documents.filterSupplierNa')}
            value={supplierUsable ? filters.supplierId : ''}
            onChange={(e) => setFilter('supplierId', e.target.value)}>
            <option value="">{t('products:documents.filterAll')}</option>
            {(suppliers || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('products:documents.filterStorage')}
          <select className={'h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-50'}
            value={filters.storageId} onChange={(e) => setFilter('storageId', e.target.value)}>
            <option value="">{t('products:documents.filterAll')}</option>
            {(storages || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm"
          onClick={() => setFilters(EMPTY_FILTERS)}>
          {t('products:documents.filterClear')}
        </Button>
      </div>


      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          {/* ⚠️ Three empty states, not one. «none yet» sends somebody to post a
              document, «nothing matched» sends them to widen the filter — and
              the third is the case where widening the SUPPLIER cannot help at
              all, because nothing recorded is of a type that can carry one. It
              is not the same as this supplier having no documents, which is an
              ordinary no-match; see filterEmptyReason for the boundary. */}
          {emptyKind === FILTER_EMPTY.NO_SUPPLIER_DOCS ? (
            <span>{t('products:documents.emptyNoSupplierDocs')}</span>
          ) : emptyKind === FILTER_EMPTY.NO_MATCH ? (
            <>
              <span>{t('products:documents.emptyNoMatchTitle')}</span>
              <span className="text-xs">{t('products:documents.emptyNoMatchHint')}</span>
            </>
          ) : (
            <>
              <span>{t('products:documents.emptyTitle')}</span>
              <span className="text-xs">{t('products:documents.emptyHint')}</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((doc) => {
            const lines = movementsOf(movements, doc.id)
            const state = reversalState(doc, documents)
            const isOpen = expanded.has(doc.id)

            return (
              // ⚠️ Identity on the row, not position. Every false check this
              // session came from the browser drive, and the last one named the
              // cause exactly: it pressed "the first enabled reverse button",
              // which describes where a thing is rather than which thing it is —
              // so it targeted the wrong document and reported a defect in
              // working code. Worse in the other direction: the same selection
              // can find what it expected on a document it did not mean and
              // announce a success that never happened.
              //
              // This is "write the condition, not the count" applied to the DOM.
              <div key={doc.id} data-doc-id={doc.id} data-doc-type={doc.doc_type} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    onClick={() => toggle(doc.id)}
                  >
                    {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronLeft className="size-4 shrink-0" />}
                    <span className="font-medium">{t(`products:docs.${doc.doc_type}.title`)}</span>
                    <span className="text-sm text-muted-foreground">{documentDate(doc.doc_date)}</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {doc.to_storage_id
                        ? t('products:documents.fromStorage', { name: nameOf(storages, doc.storage_id) })
                        : nameOf(storages, doc.storage_id)}
                    </Badge>
                    {doc.to_storage_id && (
                      <Badge variant="secondary">
                        {t('products:documents.toStorage', { name: nameOf(storages, doc.to_storage_id) })}
                      </Badge>
                    )}
                    {doc.supplier_id && <Badge variant="outline">{nameOf(suppliers, doc.supplier_id)}</Badge>}
                    {/* Named on the row too, so two documents that share a
                        date, a storage and a supplier can be told apart before
                        anybody presses anything — the list was as ambiguous as
                        the confirmation was. */}
                    {(() => {
                      const { names, more } = documentProductNames(movements, doc.id, productsById)
                      if (names.length === 0) return null
                      return (
                        <Badge variant="outline">
                          {t('products:documents.contains', {
                            names: names.join('، ') + (more > 0 ? '…' : ''),
                          })}
                        </Badge>
                      )
                    })()}
                    <Badge variant="outline">
                      {t('products:documents.lineCount', { n: lines.length })}
                    </Badge>
                    {/* ⚠️ What it was worth, and the WORD says worth of what.
                        The entry screen shows a running total while somebody
                        types and then it disappears forever, so the number
                        that matters most on a supply was visible only while
                        writing it — nobody opens a document list looking for a
                        line count.
                        "الإجمالي" was "الوحدة" one level up: it said "a sum"
                        and never said a sum of what, so a transfer's 0 and a
                        poisoned supply's 0 drew the same badge with opposite
                        meanings. Naming it removes the collision without
                        hiding anything — and the poisoned 0 must stay visible,
                        it is the fault's own signature. */}
                    {(() => {
                      const value = documentValue(movements, doc.id, productsById)
                      if (value === null) return null
                      return (
                        <Badge variant="secondary">
                          {t(documentValueLabel(doc.doc_type), {
                            total: value.toLocaleString('ar', { maximumFractionDigits: 2 }),
                          })}
                        </Badge>
                      )
                    })()}
                    {state.reason === 'alreadyReversed' && (
                      <Badge variant="outline">{t('products:documents.reversedBadge')}</Badge>
                    )}
                    {state.reason === 'isReversal' && (
                      <Badge variant="outline">{t('products:documents.isReversalBadge')}</Badge>
                    )}
                  </div>

                  {/* One action, and it is not offered twice: a document
                      already undone would swing the balance the other way. */}
                  <Button
                    type="button" variant="outline" size="sm"
                    data-reverse-for={doc.id}
                    disabled={!state.canReverse || busy}
                    onClick={() => { setConfirming(doc); setActionError('') }}
                  >
                    <Undo2 className="size-3.5" />
                    {t('products:documents.reverseButton')}
                  </Button>
                </div>

                {isOpen && (
                  <div className="border-t border-border/60 p-3">
                    {doc.note && (
                      <p className="mb-2 text-sm text-muted-foreground">{doc.note}</p>
                    )}
                    <table className="w-full text-sm">
                      <tbody>
                        {lines.map((m) => (
                          <tr key={m.id} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5">{productsById[m.product_id]?.name || '—'}</td>
                            <td className="py-1.5 text-muted-foreground">
                              {nameOf(storages, m.storage_id)}
                            </td>
                            {/* ⚠️ Direction on every line, as a word. Without
                                it a write-off line reads exactly like a supply
                                line, and a reversal — whose lines are the
                                exact opposite of the document it undoes, shown
                                right beside it — reads as a copy of the
                                mistake rather than its correction. A word and
                                not a sign, because a minus inside an Arabic
                                line is a neutral character between two
                                directions. */}
                            <td className="py-1.5">
                              {movementFrames(m, productsById[m.product_id]).direction && (
                                <Badge
                                  variant={movementFrames(m, productsById[m.product_id]).direction === 'in'
                                    ? 'secondary' : 'outline'}
                                >
                                  {t(`products:documents.direction_${movementFrames(m, productsById[m.product_id]).direction}`)}
                                </Badge>
                              )}
                            </td>
                            <td className="py-1.5">{quantityText(m)}</td>
                            <td className="py-1.5 text-muted-foreground">
                              {/* A stamped cost of zero is a real number here,
                                  not a blank — and it is exactly what the two
                                  bad documents carried. */}
                              {costText(m) || '—'}
                            </td>
                          </tr>
                        ))}
                        {lines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-muted-foreground">
                              {t('products:documents.noLines')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!confirming} onOpenChange={(o) => { if (!o) { setConfirming(null); setActionError('') } }}>
        {/* The box says which document it is about, in machine-readable form
            as well as in words. Without it a check can only ask "did a box
            open", which is true of the wrong box too. */}
        <DialogContent data-confirming-doc-id={confirming?.id || ''} className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products:documents.reverseTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            {/* The document is named, because "undo" with nothing beside it is
                a button somebody presses on the wrong row.
                ⚠️ Two elements, not one joined string. A date is a run of EN
                digits, and joining it to Arabic with a neutral dash is the
                shape lib/timeRangeDirection.test.js exists to stop — the dash
                takes the paragraph direction and the halves swap on screen
                while the DOM stays correct. Separate nodes have no pair to
                reorder. */}
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {confirming && <span>{t(`products:docs.${confirming.doc_type}.title`)}</span>}
              {confirming && <span className="text-muted-foreground">{documentDate(confirming.doc_date)}</span>}
            </p>
            {/* ⚠️ What is IN it, because nothing else tells two apart. The owner
                has two supply documents on the same date, into the same
                storage, from the same supplier, with the same line count — the
                box described both, and he could not tell them apart an hour
                after posting them. stock_documents has no doc_number, so the
                contents are the only human handle there is. A destructive
                confirmation described by something that does not identify its
                target is worse than one with no description: the first
                reassures. */}
            {confirming && (() => {
              const { names, more } = documentProductNames(movements, confirming.id, productsById)
              if (names.length === 0) return null
              return (
                <p className="flex flex-wrap items-center gap-1.5">
                  {names.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                  {more > 0 && <Badge variant="outline">{t('products:documents.andMore', { n: more })}</Badge>}
                  <Badge variant="outline">{nameOf(storages, confirming.storage_id)}</Badge>
                  {confirming.supplier_id && (
                    <Badge variant="outline">{nameOf(suppliers, confirming.supplier_id)}</Badge>
                  )}
                </p>
              )
            })()}
            <p className="text-muted-foreground">{t('products:documents.reverseMessage')}</p>
            {actionError && <div className="text-destructive">{actionError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirming(null); setActionError('') }}>
              {t('common:discard')}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmReverse}>
              {busy ? t('common:saving') : t('products:documents.reverseConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
