import { useTranslation } from 'next-i18next'
import { Warehouse, Truck } from 'lucide-react'

// The row of entry points above the products screen.
//
// Same shape as the services bar down to the class list — deliberately, because
// two bars that look alike by accident drift apart the first time either is
// touched. The reference reaches both of these from the products toolbar too.
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

export default function ProductsSecondaryBar({ view, onSelect }) {
  const { t } = useTranslation(['products', 'common'])

  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-muted/40 px-4 py-1.5">
      <SecondaryItem
        icon={Warehouse}
        label={t('products:secondaryItems.storages')}
        active={view === 'storages'}
        onClick={() => onSelect(view === 'storages' ? 'catalog' : 'storages')}
      />
      <SecondaryItem
        icon={Truck}
        label={t('products:secondaryItems.suppliers')}
        active={view === 'suppliers'}
        onClick={() => onSelect(view === 'suppliers' ? 'catalog' : 'suppliers')}
      />
    </div>
  )
}
