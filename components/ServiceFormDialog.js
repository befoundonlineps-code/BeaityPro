import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const DEFAULT_COLOR = '#7C3AED'
const SEX_OPTIONS = ['all', 'men', 'women']

export default function ServiceFormDialog({ open, onOpenChange, service, categoryId, salonId, onSaved }) {
  const { t } = useTranslation(['services', 'common'])
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('0')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [sex, setSex] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!service

  useEffect(() => {
    if (!open) return
    setError('')
    setName(service ? service.name : '')
    setDuration(service ? String(service.duration_minutes) : '30')
    setPrice(service ? String(service.price) : '0')
    setColor(service && service.color ? service.color : DEFAULT_COLOR)
    setSex(service && service.sex ? service.sex : 'all')
  }, [open, service])

  function validate() {
    if (!name.trim()) return t('services:serviceDialog.nameRequiredError')
    if (!Number(duration) || Number(duration) <= 0) return t('services:serviceDialog.durationInvalidError')
    if (Number(price) < 0 || Number.isNaN(Number(price))) return t('services:serviceDialog.priceInvalidError')
    return ''
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setSaving(true)

    const payload = {
      name: name.trim(),
      duration_minutes: Number(duration),
      price: Number(price),
      color,
      sex,
    }

    const { data, error: saveError } = isEdit
      ? await supabase.from('services').update(payload).eq('id', service.id).select()
      : await supabase.from('services').insert([{ ...payload, salon_id: salonId, category_id: categoryId }]).select()

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }
    // A write that matched no row comes back without an error but without
    // data either, so treat that as a failure rather than a silent success.
    if (!data || data.length === 0) {
      setError(t('services:serviceDialog.noRowsError'))
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('services:serviceDialog.editTitle') : t('services:serviceDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('services:serviceDialog.nameLabel')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:serviceDialog.durationLabel')}</Label>
              <Input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:serviceDialog.priceLabel')}</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('services:serviceDialog.colorLabel')}</Label>
              <Input
                type="color"
                className="h-9 p-1"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('services:serviceDialog.sexLabel')}</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            >
              {SEX_OPTIONS.map((v) => (
                <option key={v} value={v}>{t(`services:sexOptions.${v}`)}</option>
              ))}
            </select>
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
