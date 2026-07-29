import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ResourceFormDialog({ open, onOpenChange, resource, salonId, services, serviceResources, onSaved }) {
  const { t } = useTranslation(['services', 'common'])
  const isEdit = !!resource

  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('1')
  const [linkedServiceIds, setLinkedServiceIds] = useState([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeServices = (services || []).filter((s) => s.is_active)

  useEffect(() => {
    if (!open) return
    setError('')
    setSearch('')
    setName(resource ? resource.name : '')
    setCapacity(resource ? String(resource.capacity) : '1')
    setLinkedServiceIds(
      resource
        ? (serviceResources || []).filter((sr) => sr.resource_id === resource.id).map((sr) => sr.service_id)
        : []
    )
  }, [open, resource, serviceResources])

  const query = search.trim().toLowerCase()
  const visibleServices = query
    ? activeServices.filter((s) => s.name.toLowerCase().includes(query))
    : activeServices

  function toggleService(serviceId) {
    setLinkedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t('services:resources.nameRequiredError'))
      return
    }
    const capacityNumber = Number(capacity)
    if (!Number.isInteger(capacityNumber) || capacityNumber < 1) {
      setError(t('services:resources.capacityInvalidError'))
      return
    }

    setError('')
    setSaving(true)

    const payload = { name: name.trim(), capacity: capacityNumber }
    const { data, error: saveError } = isEdit
      ? await supabase.from('resources').update(payload).eq('id', resource.id).select()
      : await supabase.from('resources').insert([{ ...payload, salon_id: salonId }]).select()

    if (saveError) {
      setSaving(false)
      // Lowering capacity below what is already booked is refused by the
      // database, since the units being removed still hold appointments.
      setError(
        saveError.code === '23503'
          ? t('services:resources.capacityBelowBookedError')
          : saveError.message
      )
      return
    }
    if (!data || data.length === 0) {
      setSaving(false)
      setError(t('services:resources.noRowsError'))
      return
    }

    const resourceId = isEdit ? resource.id : data[0].id
    const existing = (serviceResources || []).filter((sr) => sr.resource_id === resourceId)
    const existingIds = existing.map((sr) => sr.service_id)
    const toAdd = linkedServiceIds.filter((id) => !existingIds.includes(id))
    const toRemoveIds = existing.filter((sr) => !linkedServiceIds.includes(sr.service_id)).map((sr) => sr.id)

    if (toRemoveIds.length > 0) {
      const { error: removeError } = await supabase.from('service_resources').delete().in('id', toRemoveIds)
      if (removeError) {
        setSaving(false)
        setError(removeError.message)
        return
      }
    }
    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('service_resources')
        .insert(toAdd.map((serviceId) => ({ salon_id: salonId, resource_id: resourceId, service_id: serviceId })))
      if (addError) {
        setSaving(false)
        setError(addError.message)
        return
      }
    }

    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('services:resources.editTitle') : t('services:resources.addTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:resources.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:resources.capacityLabel')}</Label>
              <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('services:resources.capacityHint')}</p>

          <div className="flex flex-col gap-1.5">
            <Label>{t('services:resources.linkedServicesLabel', { count: linkedServiceIds.length })}</Label>
            <Input
              placeholder={t('services:resources.searchServicesPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
              {visibleServices.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">{t('common:noResults')}</div>
              ) : (
                visibleServices.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={linkedServiceIds.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
