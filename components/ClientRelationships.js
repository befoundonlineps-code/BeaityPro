import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useClientSearch } from '../hooks/useClientSearch'
import { RELATIONSHIP_TYPES, getRelationshipLabel, getOtherClientId } from '../lib/relationships'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const RELATIONSHIP_ITEMS = Object.fromEntries(RELATIONSHIP_TYPES.map((t) => [t.value, t.label]))

export default function ClientRelationships({ clientId }) {
  const [rows, setRows] = useState([])
  const [othersById, setOthersById] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const { search, setSearch, results: searchResults } = useClientSearch(clientId)
  const [pickedClient, setPickedClient] = useState(null)
  const [relType, setRelType] = useState('spouse')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [clientId])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('client_relationships')
      .select('*')
      .or(`client_id.eq.${clientId},related_client_id.eq.${clientId}`)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setRows(data || [])
    const otherIds = [...new Set((data || []).map((r) => getOtherClientId(r, clientId)))]
    if (otherIds.length) {
      const { data: others } = await supabase.from('clients').select('id,first_name,last_name,gender').in('id', otherIds)
      const map = {}
      ;(others || []).forEach((c) => { map[c.id] = c })
      setOthersById(map)
    } else {
      setOthersById({})
    }
    setLoading(false)
  }

  async function addRelationship() {
    if (!pickedClient) return
    setError('')
    const { error } = await supabase.from('client_relationships').insert([{
      client_id: clientId, related_client_id: pickedClient.id, relationship_type: relType,
    }])
    if (error) setError(error.message)
    else {
      setAdding(false)
      setPickedClient(null)
      setSearch('')
      load()
    }
  }

  async function removeRelationship(rowId) {
    await supabase.from('client_relationships').delete().eq('id', rowId)
    load()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">الأقارب والمعارف</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>{adding ? 'إلغاء' : '+ ربط زبون'}</Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <div className="text-sm text-destructive">{error}</div>}

        {adding && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Input
              placeholder="ابحث بالاسم أو الهاتف..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPickedClient(null) }}
            />
            {searchResults.length > 0 && !pickedClient && (
              <div className="flex flex-col gap-1">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                    onClick={() => { setPickedClient(c); setSearch(`${c.first_name} ${c.last_name}`) }}
                  >
                    {c.first_name} {c.last_name} — {c.phone_number}
                  </button>
                ))}
              </div>
            )}
            {pickedClient && (
              <div className="flex items-center gap-2">
                <Select items={RELATIONSHIP_ITEMS} value={relType} onValueChange={setRelType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={addRelationship}>ربط</Button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">ما في أقارب أو معارف مرتبطين</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r) => {
              const other = othersById[getOtherClientId(r, clientId)]
              if (!other) return null
              const label = getRelationshipLabel(r, clientId, other.gender)
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Link href={`/clients/${other.id}`} className="flex items-center gap-2.5 hover:underline">
                    <Avatar size="sm">
                      <AvatarFallback style={{ background: getAvatarColor(other.id), color: '#fff' }}>
                        {getInitials(other.first_name, other.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{other.first_name} {other.last_name}</span>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => removeRelationship(r.id)}>إزالة</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
