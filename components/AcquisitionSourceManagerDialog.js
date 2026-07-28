import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AcquisitionSourceManagerDialog({ open, onOpenChange, sources, loading, onChanged, salonId }) {
  const { t } = useTranslation(['clientForm', 'common'])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!name.trim()) return
    setError('')
    setSaving(true)
    const { error } = await supabase.from('acquisition_sources').insert([{ name: name.trim(), salon_id: salonId }])
    setSaving(false)
    if (error) setError(error.message)
    else {
      setName('')
      onChanged()
    }
  }

  async function handleDelete(id) {
    await supabase.from('acquisition_sources').delete().eq('id', id)
    onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('clientForm:acquisitionSourceManager.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('clientForm:acquisitionSourceManager.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button size="sm" disabled={saving || !name.trim()} onClick={handleAdd}>
              {t('clientForm:acquisitionSourceManager.addButton')}
            </Button>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {loading ? (
            <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
          ) : sources.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('clientForm:acquisitionSourceManager.empty')}</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{s.name}</span>
                  <button type="button" className="text-xs text-destructive hover:underline" onClick={() => handleDelete(s.id)}>
                    {t('clientForm:acquisitionSourceManager.deleteButton')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('clientForm:acquisitionSourceManager.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
