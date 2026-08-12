import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { SECTIONS } from '../../constants'
import Icon from '../Icon'

// The orange strip across the top: one tab per section, and nothing else.
//
// ⚠️ NOT A RESTYLED Sidebar.js — A SECOND COMPONENT, ON PURPOSE. Sidebar is
// rendered by AppShell for every screen in the app, so changing it would
// convert the clients, appointments, services, employees and settings screens
// at the same moment, with nobody having looked at them. The owner asked for
// the products screen as a MODEL to judge before it spreads, and a shared
// component cannot be converted for one caller. Two components for the length
// of one review is the cheap half of that trade.
//
// ⇒ When the model is approved, this replaces Sidebar and Sidebar goes. Until
// then the duplication is deliberate and is named here so it is not tidied away
// by somebody who reads it as an accident.
//
// ⚠️ AND THE WINDOW BUTTONS ARE NOT DRAWN. The reference is a Windows
// application and its top-right corner carries minimise, maximise and close —
// operating-system chrome, not application design. Reproducing them in a
// browser would draw three buttons that either do nothing or fight the tab the
// page is in. The owner said as much before it was asked.
export default function RefTopBar({ onDisabledClick, userEmail, onLogout }) {
  const { t } = useTranslation(['topBar', 'common'])
  const router = useRouter()

  return (
    <div
      className="flex w-full shrink-0 items-stretch overflow-x-auto"
      style={{ background: 'var(--chrome)' }}
    >
      {SECTIONS.map((s) => {
        const label = t(`topBar:sections.${s.key}`)
        const active = s.route === router.pathname
        return (
          <button
            key={s.key}
            type="button"
            title={s.active ? label : `${label} — ${t('common:inDevelopmentSuffix')}`}
            onClick={
              s.active
                ? (s.route ? () => router.push(s.route) : undefined)
                : () => onDisabledClick && onDisabledClick(label)
            }
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs ${
              active ? 'font-semibold' : ''
            } ${s.active ? '' : 'cursor-not-allowed'}`}
            style={{
              // The active tab is a lighter box on the same orange, and its
              // label is white; every other label is the paler orange measured
              // off the reference rather than a grey. A grey label on orange
              // reads as broken; a paler orange reads as «not here».
              background: active ? 'rgba(255,255,255,0.28)' : 'transparent',
              color: active ? 'var(--chrome-ink)' : 'var(--chrome-dim)',
            }}
          >
            <Icon name={s.icon} size={14} />
            <span>{label}</span>
          </button>
        )
      })}

      {/* ⚠️ The session lives here because the reference's own top-right corner
          holds it — a padlock beside the window buttons. Ours keeps the lock
          and drops the window buttons, which are the operating system's. */}
      <div className="ms-auto flex shrink-0 items-center gap-2 px-3 text-xs" style={{ color: 'var(--chrome-ink)' }}>
        {userEmail && <span className="hidden max-w-[220px] truncate sm:inline">{userEmail}</span>}
        {onLogout && (
          <button type="button" onClick={onLogout} className="underline underline-offset-2">
            {t('common:logout')}
          </button>
        )}
      </div>
    </div>
  )
}
