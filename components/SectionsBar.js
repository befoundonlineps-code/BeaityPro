import { SECTIONS } from '../constants'
import { sectionsBar, sectionBtnActive, sectionBtnDisabled, comingSoonBadge } from '../styles'

export default function SectionsBar({ onDisabledClick }) {
  return (
    <div style={sectionsBar}>
      {SECTIONS.map((s) =>
        s.active ? (
          <button key={s.key} style={sectionBtnActive}>{s.label}</button>
        ) : (
          <button key={s.key} style={sectionBtnDisabled} onClick={() => onDisabledClick(s.label)} title="قيد التطوير">
            {s.label}
            <span style={comingSoonBadge}>قريبًا</span>
          </button>
        )
      )}
    </div>
  )
}
