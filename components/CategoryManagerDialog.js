import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function CategoryManagerDialog({ open, onOpenChange, categories, loading, onChanged, salonId }) {
  const { t } = useTranslation(['clientForm', 'common'])
  const [selectedId, setSelectedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedCategory = categories.find((c) => c.id === selectedId) || null

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
    if (!selectedCategory) return
    setNameInput(selectedCategory.name)
    setError('')
    setEditOpen(true)
  }

  async function handleSaveAdd() {
    if (!nameInput.trim()) return
    setError('')
    setSaving(true)
    const { error } = await supabase.from('categories').insert([{ name: nameInput.trim(), salon_id: salonId }])
    setSaving(false)
    if (error) setError(error.message)
    else {
      setAddOpen(false)
      onChanged()
    }
  }

  async function handleSaveEdit() {
    if (!nameInput.trim() || !selectedCategory) return
    setError('')
    setSaving(true)
    const { error } = await supabase.from('categories').update({ name: nameInput.trim() }).eq('id', selectedCategory.id)
    setSaving(false)
    if (error) setError(error.message)
    else {
      setEditOpen(false)
      onChanged()
    }
  }

  async function handleConfirmDelete() {
    if (!selectedCategory) return
    await supabase.from('categories').delete().eq('id', selectedCategory.id)
    setDeleteConfirmOpen(false)
    setSelectedId(null)
    onChanged()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleMainOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:categoryManager.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
            ) : categories.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t('clientForm:categoryManager.empty')}</div>
            ) : (
              categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className={
                    c.id === selectedId
                      ? 'rounded-lg border border-primary bg-primary/10 px-3 py-2 text-start text-sm font-medium text-primary'
                      : 'rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-muted'
                  }
                >
                  {c.name}
                </button>
              ))
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={openAdd}>
              {t('clientForm:categoryManager.addCategoryButton')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={openEdit}>
                {t('clientForm:categoryManager.editButton')}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={() => setDeleteConfirmOpen(true)}>
                {t('clientForm:categoryManager.deleteButton')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:categoryManager.addDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('clientForm:categoryManager.namePlaceholder')}
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
            <DialogTitle>{t('clientForm:categoryManager.editDialogTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('clientForm:categoryManager.namePlaceholder')}
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clientForm:categoryManager.deleteConfirmMessage', { name: selectedCategory?.name || '' })}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>{t('common:discard')}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>{t('clientForm:categoryManager.confirmDeleteButton')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
