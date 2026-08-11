import { useTranslation } from 'next-i18next'
import { navigationBlocked } from '../lib/storageScope'
import { Warehouse, Truck, PackagePlus, PackageMinus, Undo2, ArrowLeftRight, ClipboardCheck, ClipboardList, ListChecks, ScrollText, Boxes } from 'lucide-react'

// The row of entry points above the products screen.
//
// Same shape as the services bar down to the class list — deliberately, because
// two bars that look alike by accident drift apart the first time either is
// touched. The reference reaches all of these from its products toolbar too,
// each as its own button rather than one button with a type picker, and this
// follows it: the four documents differ in which fields they even have, so a
// picker would redraw the form under somebody mid-entry.
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
const ITEMS = [
  { view: 'storages', icon: Warehouse, key: 'storages' },
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

export default function ProductsSecondaryBar({ view, onSelect, lensStorageId }) {
  const { t } = useTranslation(['products', 'common'])

  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-muted/40 px-4 py-1.5">
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
            active={view === item.view}
            disabled={blocked}
            blockedTitle={t('products:lens.pickStorageFirst')}
            onClick={() => onSelect(view === item.view ? 'catalog' : item.view)}
          />
        )
      })}
    </div>
  )
}
