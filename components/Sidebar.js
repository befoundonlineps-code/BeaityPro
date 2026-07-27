import { SECTIONS } from '../constants'
import Icon from './Icon'

export default function Sidebar({ onDisabledClick }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-e border-sidebar-border bg-sidebar py-4">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          title={s.active ? s.label : `${s.label} — قيد التطوير`}
          onClick={s.active ? undefined : () => onDisabledClick(s.label)}
          className={
            s.active
              ? 'flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'
              : 'flex size-10 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground/50 hover:bg-sidebar-accent'
          }
        >
          <Icon name={s.icon} />
        </button>
      ))}
    </div>
  )
}
