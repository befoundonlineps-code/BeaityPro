import { SECTIONS } from '../constants'
import { sidebar, sidebarLogo, sidebarIconBtn } from '../styles'
import Icon from './Icon'

export default function Sidebar({ onDisabledClick }) {
  return (
    <div style={sidebar}>
      <div style={sidebarLogo}>B</div>
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          style={sidebarIconBtn(s.active)}
          title={s.active ? s.label : `${s.label} — قيد التطوير`}
          onClick={s.active ? undefined : () => onDisabledClick(s.label)}
        >
          <Icon name={s.icon} />
        </button>
      ))}
    </div>
  )
}
