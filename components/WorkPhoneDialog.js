import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Phone, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { buildDirectory, SOURCE_EMPLOYEE } from '../lib/contactDirectory'
import { dbErrorSentence } from '../lib/dbErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Who to ring, without leaving the calendar.
//
// The people working today come from the windows the calendar has already
// worked out — the same test the view menu's "on shift" uses — so somebody
// marked off, or whose hours were changed for the day, drops off this list
// without anything here knowing those features exist.
//
// Fixed contacts are the other half: the owner, a supplier, anybody with a
// number and no shift. They can be added but not yet edited or removed; the
// database has no policy for either, so the gap is a locked door rather than
// a missing button.
export default function WorkPhoneDialog({
  open, onOpenChange, employees, windowsByEmployee, contacts, contactsLoading,
  salonId, onContactAdded,
}) {
  const { t } = useTranslation(['appointments', 'employees', 'common'])

  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    setAdding(false)
    setName('')
    setPhone('')
    setError('')
  }, [open])

  const entries = useMemo(
    () => buildDirectory({ employees, windowsByEmployee, contacts, query }),
    [employees, windowsByEmployee, contacts, query]
  )

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) return
    setError('')
    setSaving(true)
    const { error: saveError } = await supabase
      .from('salon_contacts')
      .insert([{ salon_id: salonId, name: name.trim(), phone_number: phone.trim() }])
    setSaving(false)
    if (saveError) {
      setError(dbErrorSentence(saveError, t, 'addSalonContact'))
      return
    }
    setName('')
    setPhone('')
    setAdding(false)
    onContactAdded()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('appointments:workPhone.title')}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute inset-inline-start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-8"
            placeholder={t('appointments:workPhone.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          {contactsLoading ? (
            <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {query ? t('common:noResults') : t('appointments:workPhone.nobodyOnShift')}
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{entry.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.source === SOURCE_EMPLOYEE && entry.role
                      ? t(`employees:roles.${entry.role}`)
                      : t('appointments:workPhone.contactBadge')}
                  </span>
                </span>
                {/* A number is a link, so a tap on a phone dials it and a
                    click on a desktop still selects cleanly. Somebody with no
                    number saved says so rather than showing an empty row that
                    looks like a rendering fault. */}
                {entry.phone ? (
                  <a
                    href={`tel:${entry.phone.replace(/\s/g, '')}`}
                    className="flex shrink-0 items-center gap-1.5 text-sm text-primary hover:underline"
                    dir="ltr"
                  >
                    <Phone className="size-3.5" />
                    {entry.phone}
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('appointments:workPhone.noNumber')}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {adding ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('appointments:workPhone.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('appointments:workPhone.phoneLabel')}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={saving} onClick={() => { setAdding(false); setError('') }}>
                {t('common:discard')}
              </Button>
              <Button size="sm" disabled={saving || !name.trim() || !phone.trim()} onClick={handleAdd}>
                {saving ? t('common:saving') : t('common:save')}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
            <Plus />
            {t('appointments:workPhone.addContactButton')}
          </Button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
