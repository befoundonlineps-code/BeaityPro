import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { SECTIONS } from '../constants'
import Icon from './Icon'
import ClientsSecondaryBar from './ClientsSecondaryBar'

const activeButtonClass = 'flex shrink-0 items-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2.5 text-sm font-medium text-sidebar-primary-foreground'
const disabledButtonClass = 'flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-muted-foreground/50 hover:bg-sidebar-accent'

export default function Sidebar({ onDisabledClick }) {
  const { t } = useTranslation(['topBar', 'common'])
  const router = useRouter()

  return (
    <div className="flex flex-col">
      <div className="flex w-full items-center justify-between gap-2 overflow-x-auto border-b border-sidebar-border bg-sidebar px-4 py-2">
        {SECTIONS.map((s) => {
          const label = t(`topBar:sections.${s.key}`)
          return (
            <button
              key={s.key}
              title={s.active ? label : `${label} — ${t('common:inDevelopmentSuffix')}`}
              onClick={s.active ? (s.route ? () => router.push(s.route) : undefined) : () => onDisabledClick(label)}
              className={s.active ? activeButtonClass : disabledButtonClass}
            >
              <Icon name={s.icon} size={18} />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          )
        })}
      </div>
      {router.pathname === '/' && <ClientsSecondaryBar onDisabledClick={onDisabledClick} />}
    </div>
  )
}
