import { useTranslation } from 'next-i18next'
import { navigationBlocked } from '../lib/storageScope'
import { Truck, PackagePlus, PackageMinus, Undo2, ArrowLeftRight, ClipboardCheck, ClipboardList, ListChecks, ScrollText, Boxes } from 'lucide-react'

// The row of entry points above the products screen.
//
// Same shape as the services bar down to the class list — deliberately, because
// two bars that look alike by accident drift apart the first time either is
// touched.
//
// 🔴 THIS BAR IS NOT PART OF THE REFERENCE CONVERSION, AND IT WAS BRIEFLY
// DELETED BECAUSE I THOUGHT IT WAS.
//
// The reference reaches the same operations from a band of its own, so the band
// was rebuilt in its image and this file was removed as dead. That widened the
// ask: what was asked for is the reference's CONTENT AREA — the tree, the dense
// grid, the modal per operation. The top bar and this one keep the product's
// existing design and stay identical across every screen in it, which is the
// whole reason a person can move between sections without relearning where
// things are.
//
// ⇒ Restored as it was. What DID change is one line at the bottom: pressing an
// entry opens it as a modal over the catalogue rather than switching a tab. The
// launcher is ours; what it launches is the converted part.
//
// ⚠️ And the order is ours again too. It had been rearranged to the reference's
// — order · supply · transfer · write-off · return — on the grounds that
// nothing in our data preferred either. True, but the reference has no
// authority over a bar it is not being copied into, and the order below carries
// written reasons of its own.
function SecondaryItem({ icon: IconComp, label, active, disabled, blockedTitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? blockedTitle : label}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] ${
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : `hover:bg-sidebar-accent ${active ? 'bg-sidebar-accent font-medium text-primary' : 'text-foreground'}`
      }`}
    >
      <IconComp className="size-5" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}

// The directories first, then the documents that write movements. The bar
// scrolls sideways when it has to (overflow-x-auto), which is why six entries
// is a layout question rather than a design one.
// 🔴 `storages` IS NOT HERE, AND IT HAS MOVED IN BOTH DIRECTIONS IN ONE DAY.
//
// It was taken out to sit beside the storage picker as «تعديل المستودعات»,
// following the reference. Then it came back, because the reference has no
// authority over a bar that is not being copied. Then the owner named «طريقة
// الوصول لإدارة المستودعات» explicitly among the things that take the
// reference's form — the CONTENT AREA is a complete replacement, and the way
// you reach the storages editor is part of it.
//
// ⇒ Out again, for a different reason than the first time: not «the reference
// puts it there» but «the owner put the content area, including this path,
// under the reference». The shape is the same and the authority is not, and
// that distinction is why it is written down instead of just done.
//
// ⚠️ AND ONLY ONE OF THE TWO, EVER. A button here AND a link in the box is two
// controls for one concept — the fault this module already paid for with the
// duplicate storage picker.
const ITEMS = [
  { view: 'suppliers', icon: Truck, key: 'suppliers' },
  // ⚠️ BEFORE the supply and not after it, because that is the order the work
  // happens in: the order is written, the goods come, the supply is filled from
  // it. Placed among the documents it would read as a fifth document, and it
  // moves nothing.
  { view: 'orders', icon: ClipboardList, key: 'orders' },
  { view: 'supply', icon: PackagePlus, key: 'supply' },
  { view: 'write_off', icon: PackageMinus, key: 'writeOff' },
  { view: 'return_to_supplier', icon: Undo2, key: 'returnToSupplier' },
  { view: 'transfer', icon: ArrowLeftRight, key: 'transfer' },
  // ⚠️ Beside the documents rather than among them: a stocktake writes
  // movements like they do, but nobody types a movement — they type a count
  // and the difference is derived. Its own screen for the same reason it has
  // its own function.
  { view: 'stocktake', icon: ClipboardCheck, key: 'stocktake' },
  // ⚠️ Beside the stocktake, because it is the stocktake read the other way
  // round: the sheet asks what is on the shelf, this asks what has been asked.
  { view: 'coverage', icon: ListChecks, key: 'coverage' },
  // Last two, because they are where you go after posting rather than to post.
  { view: 'documents', icon: ScrollText, key: 'documents' },
  // ⚠️ "What do I have?" is asked once; "what is about to run out?" is asked
  // daily — so this is the entry a person returns to, not one they pass
  // through.
  { view: 'balances', icon: Boxes, key: 'balances' },
]

export default function ProductsSecondaryBar({ op, onSelect, lensStorageId }) {
  const { t } = useTranslation(['products', 'common'])

  return (
    // ⚠️ NO BOTTOM BORDER ANY MORE, and that is the only class that changed.
    // The bar used to be a full-width row and owned the rule under it; it now
    // shares a band with the storage box, and the band carries one rule for
    // both. Two rules at slightly different heights inside one band is the kind
    // of seam nobody can name but everybody sees.
    <div className="flex w-full items-center gap-1 overflow-x-auto bg-muted/40 px-4 py-1.5">
      {ITEMS.map((item) => {
        // 🔴 GREYED WHILE THE LENS IS WIDE, and the reason is not that the
        // screen would break — it is that it would NOT. currentLens resolves
        // «all» to the default storage on any view that may not widen, so
        // pressing this from a catalogue showing all storages would land on the
        // first live storage and count it. Nothing errors; somebody counts a
        // shelf they never chose.
        //
        // ⚠️ Greyed rather than hidden: a button that vanishes reads as a
        // missing feature, and one that greys says «not from here». The lens is
        // on the same screen, so the fix is one control away.
        const blocked = navigationBlocked(item.view, lensStorageId)
        return (
          <SecondaryItem
            key={item.view}
            icon={item.icon}
            label={t(`products:secondaryItems.${item.key}`)}
            active={op === item.view}
            disabled={blocked}
            blockedTitle={t('products:lens.pickStorageFirst')}
            // ⚠️ THE ONE LINE THAT CHANGED. It used to switch a tab and toggle
            // back to the catalogue; it now opens an operation as a modal over
            // the catalogue, and pressing the open one closes it. The catalogue
            // is not a destination any more — it is what is always underneath.
            onClick={() => onSelect(op === item.view ? null : item.view)}
          />
        )
      })}
    </div>
  )
}
