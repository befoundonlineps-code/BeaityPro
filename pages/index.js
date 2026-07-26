import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [clients, setClients] = useState([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setClients(data)
  }

  async function addClient(e) {
    e.preventDefault()
    setError('')

    const { data: existing } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('phone_number', phone)

    if (existing && existing.length > 0) {
      setError(`رقم الهاتف مستخدم أصلًا لزبون: ${existing[0].first_name} ${existing[0].last_name}`)
      return
    }

    const { error } = await supabase
      .from('clients')
      .insert([{ first_name: firstName, last_name: lastName, phone_number: phone }])

    if (error) {
      setError(error.message)
    } else {
      setFirstName('')
      setLastName('')
      setPhone('')
      loadClients()
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif', direction: 'rtl' }}>
      <h1>موديول الزبائن</h1>

      <form onSubmit={addClient} style={{ marginBottom: 30, padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>زبون جديد</h3>
        <input
          placeholder="الاسم الأول"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          required
        />
        <input
          placeholder="اسم العائلة"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
        />
        <input
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }}
          required
        />
        <button type="submit" style={{ padding: '8px 20px' }}>حفظ الزبون</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>

      <h3>قائمة الزبائن ({clients.length})</h3>
      {clients.map((c) => (
        <div key={c.id} style={{ padding: 10, borderBottom: '1px solid #eee' }}>
          <b>{c.first_name} {c.last_name}</b> — {c.phone_number}
        </div>
      ))}
    </div>
  )
}
