import { fieldRow, bLabel, bInput, bInputFocus } from '../styles'

export default function BField({ label, focusKey, focused, setFocused, ...props }) {
  const isFocused = focused === focusKey
  return (
    <div style={fieldRow}>
      <label style={bLabel}>{label}</label>
      <input
        style={{ ...bInput, ...(isFocused ? bInputFocus : {}) }}
        onFocus={() => setFocused(focusKey)}
        onBlur={() => setFocused(null)}
        {...props}
      />
    </div>
  )
}
