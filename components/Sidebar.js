import { SECTIONS } from '../constants'
import Icon from './Icon'
import ClientsQuickMenu from './ClientsQuickMenu'

const activeButtonClass = 'flex shrink-0 items-center gap-1.5 rounded-lg bg-sidebar-primary px-3 py-2 text-xs font-medium text-sidebar-primary-foreground'
const disabledButtonClass = 'flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-muted-foreground/50 hover:bg-sidebar-accent'

export default function Sidebar({ onDisabledClick }) {
  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-3 py-1.5">
      {SECTIONS.map((s) => {
        if (s.key === 'clients') {
          return <ClientsQuickMenu key={s.key} triggerClassName={activeButtonClass} onDisabledClick={onDisabledClick} />
        }
        return (
          <button
            key={s.key}
            title={s.active ? s.label : `${s.label} — قيد التطوير`}
            onClick={s.active ? undefined : () => onDisabledClick(s.label)}
            className={s.active ? activeButtonClass : disabledButtonClass}
          >
            <Icon name={s.icon} size={16} />
            <span className="whitespace-nowrap">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
