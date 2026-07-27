export const BLUE = '#2E5AAC'
export const BLUE_DARK = '#1F3E7A'
export const BLUE_LIGHT = '#EAF0FB'
export const BORDER = '#d7dce3'
export const TEXT_MUTED = '#8a8a8a'

export const page = { fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: 'rtl', background: '#eef1f6', minHeight: '100vh' }

export const topBar = {
  background: `linear-gradient(90deg, ${BLUE_DARK}, ${BLUE})`, color: '#fff',
  padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
export const topBarTitle = { fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }
export const logoCircle = {
  width: 34, height: 34, borderRadius: '50%', background: '#fff', color: BLUE,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
}
export const logoutBtn = {
  background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)',
  borderRadius: 5, padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
}

export const sectionsBar = {
  background: '#fff', borderBottom: `1px solid ${BORDER}`,
  display: 'flex', alignItems: 'center', overflowX: 'auto', padding: '0 20px',
}
export const sectionBtnActive = {
  padding: '13px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: BLUE, borderBottom: `3px solid ${BLUE}`, background: 'none', border: 'none',
  marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0,
}
export const sectionBtnDisabled = {
  padding: '13px 14px', fontSize: 13, fontWeight: 500, cursor: 'not-allowed',
  color: '#c3c8d1', border: 'none', background: 'none', display: 'flex',
  alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0,
}
export const comingSoonBadge = {
  fontSize: 9, background: '#f0f2f5', color: '#a7acb5', borderRadius: 8,
  padding: '1px 6px', fontWeight: 700,
}

export const subBar = {
  background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '10px 28px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
export const btnPrimary = {
  background: BLUE, color: '#fff', border: 'none', borderRadius: 5,
  padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 8,
}
export const btnSecondary = {
  background: '#fff', color: '#555', border: `1px solid ${BORDER}`, borderRadius: 5,
  padding: '7px 18px', fontSize: 13, cursor: 'pointer',
}

export const layout = { display: 'grid', gridTemplateColumns: '1fr 260px', gap: 18, maxWidth: 1180, margin: '18px auto', padding: '0 16px' }

export const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, marginBottom: 16, overflow: 'hidden' }
export const cardHeader = {
  background: BLUE_LIGHT, color: BLUE_DARK, fontWeight: 700, fontSize: 13.5,
  padding: '10px 16px', borderBottom: `1px solid ${BORDER}`,
}
export const cardBody = { padding: '16px 18px' }

export const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }
export const fieldRow = { display: 'flex', flexDirection: 'column', gap: 4 }
export const bLabel = { fontSize: 12, color: '#555', fontWeight: 600 }
export const bInput = {
  border: `1px solid ${BORDER}`, borderRadius: 5, padding: '8px 10px', fontSize: 13.5,
  outline: 'none', fontFamily: 'inherit', background: '#fff', color: '#222',
}
export const bInputFocus = { border: `1px solid ${BLUE}`, boxShadow: `0 0 0 2px ${BLUE_LIGHT}` }

export const tabBar = { display: 'flex', gap: 2, marginBottom: 0, borderBottom: `1px solid ${BORDER}`, background: '#fff', padding: '0 4px' }
export const tabBtn = (active) => ({
  padding: '11px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  color: active ? BLUE : TEXT_MUTED,
  borderBottom: active ? `3px solid ${BLUE}` : '3px solid transparent',
  background: 'none', border: 'none', marginBottom: -1,
})

export const sideCard = { ...card, height: 'fit-content' }
export const sideHeader = { ...cardHeader, background: BLUE_DARK, color: '#fff' }
export const tipItem = () => ({
  display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 14px',
  borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, color: '#444', lineHeight: 1.5,
})
export const dot = (color) => ({ width: 7, height: 7, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 })
