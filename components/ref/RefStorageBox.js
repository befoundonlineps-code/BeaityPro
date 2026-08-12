import { useTranslation } from 'next-i18next'
import { FolderCog, Warehouse } from 'lucide-react'
// ⚠️ IMPORTED, NOT SPELLED. The first draft wrote `value="all"` here, which is
// a second spelling of a sentinel whose whole job is to be one value — and the
// day it changes, this option would go on submitting the old string and the
// picker would silently stop widening. lib/storageScope.js imports nothing, so
// there is no cycle to buy with it.
import { ALL_STORAGES } from '../../lib/storageScope'

// «Where am I working», and the editor for the thing it picks — in the
// reference's shape.
//
// 🔴 THIS REPLACES A BREADCRUMB ROW THAT WAS KEPT OUT OF CAUTION AND SHOULD NOT
// HAVE BEEN.
//
// What stood here was the product's old row: «المنتجات / كتالوج المنتجات» on
// one side and a rounded `h-9` select on the other. It survived the conversion
// because it sits high on the screen and looked like chrome — and the owner
// named exactly that instinct: the content area is a COMPLETE replacement, with
// no piece of the old look kept because it seemed minor.
//
// ⇒ Both halves go. The breadcrumb is redundant here anyway: the reference puts
// the same sentence in the tree's root row — «المنتجات (مستودع «…»)» — where it
// also names the storage the numbers below belong to, which a breadcrumb never
// did.
//
// ⚠️ A BORDERED BOX, NOT A LABELLED FIELD. The distinction is the reference's
// and it carries meaning: the picker and the link inside it are one subject —
// the storages — so they share a frame. A field floating in a toolbar reads as
// one of several unrelated controls.
export default function RefStorageBox({
  value, onChange, choices, mayWiden, allLabel, noneLabel, archivedLabel,
  onEditStorages, children,
}) {
  const { t } = useTranslation(['products', 'common'])

  return (
    <div className="flex shrink-0 items-stretch gap-3 border-b border-[var(--rule)] bg-white px-2 py-1.5">
      <div className="flex w-[230px] shrink-0 flex-col gap-1 border border-[var(--rule)] px-2 py-1">
        <span className="text-[10px] leading-none text-muted-foreground">
          {t('products:lens.label')}
        </span>

        <div className="flex items-center gap-1">
          <Warehouse className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <select
            data-lens-picker
            className="h-6 min-w-0 flex-1 border border-[var(--rule)] bg-white px-1 text-xs outline-none focus:border-[var(--chrome)]"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {/* ⚠️ Only where widening answers the screen's question. The
                catalogue and the document list can be asked of the whole salon;
                a stocktake and a supply cannot — and those are refused from the
                bar rather than resolved quietly. */}
            {mayWiden && <option value={ALL_STORAGES}>{allLabel}</option>}
            {choices.length === 0 && <option value="">{noneLabel}</option>}
            {choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? archivedLabel(s.name) : s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 🔴 THE WAY INTO THE STORAGES EDITOR, AND IT LIVES HERE BY DECISION
            RATHER THAN BY IMITATION. It was a button in the operations bar; the
            owner named «طريقة الوصول لإدارة المستودعات» among the things the
            content area replaces. Beside the list it edits, under the picker
            that reads it. */}
        <button
          type="button"
          onClick={onEditStorages}
          data-edit-storages
          className="flex items-center gap-1 text-[11px] leading-none text-foreground hover:underline"
        >
          <FolderCog className="size-3.5 shrink-0" strokeWidth={1.5} />
          {t('products:refShell.editStorages')}
        </button>
      </div>

      {/* Anything the screen wants beside the box — today, the notice that the
          colours here are not decided. */}
      <div className="flex min-w-0 flex-1 items-start justify-end">{children}</div>
    </div>
  )
}
