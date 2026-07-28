import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AcquisitionSourceManagerDialog({ open, onOpenChange, sources, loading, onChanged, salonId }) {
  const { t } = useTranslation(['clientForm', 'common'])
  const [selectedId, setSelectedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteSuccessName, setDeleteSuccessName] = useState(null)

  const selectedSource = sources.find((s) => s.id === selectedId) || null

  function handleMainOpenChange(next) {
    if (!next) setSelectedId(null)
    onOpenChange(next)
  }

  function openAdd() {
    setNameInput('')
    setError('')
    setAddOpen(true)
  }

  function openEdit() {
    if (!selectedSource) return
    setNameInput(selectedSource.name)
    setError('')
    setEditOpen(true)
  }

  function openDeleteConfirm() {
    setError('')
    setDeleteSuccessName(null)
    setDeleteConfirmOpen(true)
  }

  function closeDeleteConfirm(next) {
    setDeleteConfirmOpen(next)
    if (!next) setDeleteSuccessName(null)
  }

  async function handleSaveAdd() {
    if (!nameInput.trim()) return
    setError('')
    setSaving(true)
    const { error } = await supabase.from('acquisition_sources').insert([{ name: nameInput.trim(), salon_id: salonId }])
    setSaving(false)
    if (error) setError(error.message)
    else {
      setAddOpen(false)
      onChanged()
    }
  }

  async function handleSaveEdit() {
    if (!nameInput.trim() || !selectedSource) return
    setError('')
    setSaving(true)
    const { error } = await supabase.from('acquisition_sources').update({ name: nameInput.trim() }).eq('id', selectedSource.id)
    setSaving(false)
    if (error) setError(error.message)
    else {
      setEditOpen(false)
      onChanged()
    }
  }

  async function handleConfirmDelete() {
    if (!selectedSource) return
    const name = selectedSource.name
    setError('')
    setSaving(true)
    const { data, error } = await supabase.from('acquisition_sources').delete().eq('id', selectedSource.id).select()
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setError(t('clientForm:acquisitionSourceManager.deleteNoRowsMessage'))
      return
    }
    setSelectedId(null)
    setDeleteSuccessName(name)
    onChanged()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleMainOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:acquisitionSourceManager.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
            ) : sources.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('clientForm:acquisitionSourceManager.empty')}</div>
            ) : (
              sources.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  className={
                    s.id === selectedId
                      ? 'rounded-lg border border-primary bg-primary/10 px-3 py-2 text-start text-sm font-medium text-primary'
                      : 'rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-muted'
                  }
                >
                  {s.name}
                </button>
              ))
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={openAdd}>
              {t('clientForm:acquisitionSourceManager.addSourceButton')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={openEdit}>
                {t('clientForm:acquisitionSourceManager.editButton')}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={openDeleteConfirm}>
                {t('clientForm:acquisitionSourceManager.deleteButton')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:acquisitionSourceManager.addDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('clientForm:acquisitionSourceManager.namePlaceholder')}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            autoFocus
          />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('common:discard')}</Button>
            <Button disabled={saving || !nameInput.trim()} onClick={handleSaveAdd}>
              {saving ? t('common:saving') : t('common:save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:acquisitionSourceManager.editDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('clientForm:acquisitionSourceManager.namePlaceholder')}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            autoFocus
          />
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('common:discard')}</Button>
            <Button disabled={saving || !nameInput.trim()} onClick={handleSaveEdit}>
              {saving ? t('common:saving') : t('common:save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={closeDeleteConfirm}>
        <DialogContent>
          {deleteSuccessName ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('clientForm:acquisitionSourceManager.deleteSuccessMessage', { name: deleteSuccessName })}</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => closeDeleteConfirm(false)}>{t('common:done')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t('clientForm:acquisitionSourceManager.deleteConfirmMessage', { name: selectedSource?.name || '' })}</DialogTitle>
              </DialogHeader>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <DialogFooter>
                <Button variant="outline" onClick={() => closeDeleteConfirm(false)}>{t('common:discard')}</Button>
                <Button variant="destructive" disabled={saving} onClick={handleConfirmDelete}>
                  {saving ? t('common:saving') : t('clientForm:acquisitionSourceManager.confirmDeleteButton')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
