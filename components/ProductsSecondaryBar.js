import { useTranslation } from 'next-i18next'
import { Warehouse, Truck, PackagePlus, PackageMinus, Undo2, ArrowLeftRight, ScrollText } from 'lucide-react'

// The row of entry points above the products screen.
//
// Same shape as the services bar down to the class list — deliberately, because
// two bars that look alike by accident drift apart the first time either is
// touched. The reference reaches all of these from its products toolbar too,
// each as its own button rather than one button with a type picker, and this
// follows it: the four documents differ in which fields they even have, so a
// picker would redraw the form under somebody mid-entry.
function SecondaryItem({ icon: IconComp, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] hover:bg-sidebar-accent ${
        active ? 'bg-sidebar-accent font-medium text-primary' : 'text-foreground'
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
  { view: 'supply', icon: PackagePlus, key: 'supply' },
  { view: 'write_off', icon: PackageMinus, key: 'writeOff' },
  { view: 'return_to_supplier', icon: Undo2, key: 'returnToSupplier' },
  { view: 'transfer', icon: ArrowLeftRight, key: 'transfer' },
  // Last, because it is where you go after posting rather than to post.
  { view: 'documents', icon: ScrollText, key: 'documents' },
]

export default function ProductsSecondaryBar({ view, onSelect }) {
  const { t } = useTranslation(['products', 'common'])

  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-muted/40 px-4 py-1.5">
      {ITEMS.map((item) => (
        <SecondaryItem
          key={item.view}
          icon={item.icon}
          label={t(`products:secondaryItems.${item.key}`)}
          active={view === item.view}
          onClick={() => onSelect(view === item.view ? 'catalog' : item.view)}
        />
      ))}
    </div>
  )
}
