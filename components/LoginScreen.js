import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { page, fieldRow, bLabel, bInput, btnPrimary, logoCircle, BLUE, BLUE_DARK, TEXT_MUTED, BORDER } from '../styles'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('البريد الإلكتروني أو كلمة السر غير صحيحة')
  }

  return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleLogin} style={{
        background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: '36px 32px', width: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ ...logoCircle, background: BLUE, color: '#fff', margin: '0 auto 10px', width: 48, height: 48, fontSize: 20 }}>B</div>
          <h2 style={{ margin: 0, fontSize: 18, color: BLUE_DARK }}>نظام Beauty</h2>
          <p style={{ fontSize: 12.5, color: TEXT_MUTED, marginTop: 4 }}>تسجيل الدخول</p>
        </div>

        <div style={{ ...fieldRow, marginBottom: 14 }}>
          <label style={bLabel}>البريد الإلكتروني</label>
          <input style={bInput} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={{ ...fieldRow, marginBottom: 20 }}>
          <label style={bLabel}>كلمة السر</label>
          <input style={bInput} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p style={{ color: '#a33', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ ...btnPrimary, width: '100%', marginLeft: 0, padding: '10px 0' }}>
          {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  )
}
