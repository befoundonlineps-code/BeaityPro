import { useTranslation } from 'next-i18next'
import { Banknote, Settings } from 'lucide-react'

// The row of entry points above the services screen.
//
// The same shape as the clients bar — icon over label, one fixed row under
// the main tab — down to the class list, because two bars that look alike by
// accident drift apart the first time either is touched. Two items here
// rather than that one's eight, and neither is a "soon" placeholder: both do
// something today.
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

export default function ServicesSecondaryBar({ onSetPrices, onResources, resourcesActive }) {
  const { t } = useTranslation(['services', 'common'])

  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-muted/40 px-4 py-1.5">
      <SecondaryItem
        icon={Banknote}
        label={t('services:secondaryItems.setPrices')}
        onClick={onSetPrices}
      />
      {/* The resources module, moved here from a tab and otherwise untouched:
          the button changes where it is reached from and nothing else. */}
      <SecondaryItem
        icon={Settings}
        label={t('services:secondaryItems.resources')}
        active={resourcesActive}
        onClick={onResources}
      />
    </div>
  )
}
