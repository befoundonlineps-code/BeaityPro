import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { dbErrorSentence } from '../lib/dbErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Managing one of the reason lists, with the table and the translation keys
// passed in rather than baked into a copy per list.
//
// There are already three hand-copied versions of this — cancellation,
// reschedule and adjustment — and folding them into this one is a task the
// owner has deferred deliberately. They are left alone here. This exists so
// absence reasons do not become a fourth copy while that task waits: the
// cheapest moment to not duplicate something is before it is duplicated.
//
// A reason that was ever used on a real record is kept forever — it is
// evidence of something that actually happened, not a label that can drift.
// Deleting one is only ever offered as a fallback once a genuine delete has
// been refused by the foreign key (23503); deactivating removes it from the
// dropdown without erasing the history it explains.
export default function ReasonManagerDialog({
  open, onOpenChange, reasons, loading, onChanged, salonId, table, i18nPrefix,
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const [selectedId, setSelectedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inUse, setInUse] = useState(false)
  const [deleteSuccessName, setDeleteSuccessName] = useState(null)

  const key = (suffix) => `appointments:${i18nPrefix}.${suffix}`
  const selectedReason = (reasons || []).find((r) => r.id === selectedId) || null

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
    if (!selectedReason) return
    setNameInput(selectedReason.name)
    setError('')
    setEditOpen(true)
  }

  function openDeleteConfirm() {
    setError('')
    setInUse(false)
    setDeleteSuccessName(null)
    setDeleteConfirmOpen(true)
  }

  function closeDeleteConfirm(next) {
    setDeleteConfirmOpen(next)
    if (!next) { setDeleteSuccessName(null); setInUse(false) }
  }

  async function handleSaveAdd() {
    if (!nameInput.trim()) return
    setError('')
    setSaving(true)
    const { error: saveError } = await supabase.from(table).insert([{ name: nameInput.trim(), salon_id: salonId }])
    setSaving(false)
    if (saveError) setError(dbErrorSentence(saveError, t, `add:${table}`))
    else {
      setAddOpen(false)
      onChanged()
    }
  }

  async function handleSaveEdit() {
    if (!nameInput.trim() || !selectedReason) return
    setError('')
    setSaving(true)
    const { error: saveError } = await supabase.from(table).update({ name: nameInput.trim() }).eq('id', selectedReason.id)
    setSaving(false)
    if (saveError) setError(dbErrorSentence(saveError, t, `edit:${table}`))
    else {
      setEditOpen(false)
      onChanged()
    }
  }

  async function handleConfirmDelete() {
    if (!selectedReason) return
    const name = selectedReason.name
    setError('')
    setInUse(false)
    setSaving(true)
    const { data, error: deleteError } = await supabase.from(table).delete().eq('id', selectedReason.id).select()
    setSaving(false)
    if (deleteError) {
      // 23503 = foreign_key_violation: some record still cites this reason.
      // Deleting the label under a real record would leave it unexplained,
      // so deactivating is offered instead.
      if (deleteError.code === '23503') {
        setInUse(true)
        setError(t(key('deleteInUseMessage'), { name }))
      } else {
        setError(dbErrorSentence(deleteError, t, `delete:${table}`))
      }
      return
    }
    if (!data || data.length === 0) {
      setError(t(key('deleteNoRowsMessage')))
      return
    }
    setSelectedId(null)
    setDeleteSuccessName(name)
    onChanged()
  }

  async function handleToggleActive() {
    if (!selectedReason) return
    setError('')
    setSaving(true)
    const { error: toggleError } = await supabase
      .from(table)
      .update({ is_active: !selectedReason.is_active })
      .eq('id', selectedReason.id)
    setSaving(false)
    if (toggleError) setError(dbErrorSentence(toggleError, t, `toggle:${table}`))
    else onChanged()
  }

  async function handleDeactivateFromDeleteDialog() {
    await handleToggleActive()
    closeDeleteConfirm(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleMainOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(key('title'))}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
            ) : (reasons || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">{t(key('empty'))}</div>
            ) : (
              reasons.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={
                    r.id === selectedId
                      ? 'flex items-center justify-between rounded-lg border border-primary bg-primary/10 px-3 py-2 text-start text-sm font-medium text-primary'
                      : 'flex items-center justify-between rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-muted'
                  }
                >
                  <span className={r.is_active ? '' : 'text-muted-foreground line-through'}>{r.name}</span>
                  {!r.is_active && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t(key('inactiveBadge'))}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" size="sm" onClick={openAdd}>
              {t(key('addReasonButton'))}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={handleToggleActive}>
                {selectedReason?.is_active ? t(key('deactivateButton')) : t(key('activateButton'))}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={openEdit}>
                {t(key('editButton'))}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={openDeleteConfirm}>
                {t(key('deleteButton'))}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(key('addDialogTitle'))}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t(key('namePlaceholder'))}
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
            <DialogTitle>{t(key('editDialogTitle'))}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t(key('namePlaceholder'))}
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
                <DialogTitle>{t(key('deleteSuccessMessage'), { name: deleteSuccessName })}</DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => closeDeleteConfirm(false)}>{t('common:done')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {inUse ? error : t(key('deleteConfirmMessage'), { name: selectedReason?.name || '' })}
                </DialogTitle>
              </DialogHeader>
              {!inUse && error && <div className="text-sm text-destructive">{error}</div>}
              <DialogFooter>
                <Button variant="outline" onClick={() => closeDeleteConfirm(false)}>{t('common:discard')}</Button>
                {inUse ? (
                  <Button disabled={saving} onClick={handleDeactivateFromDeleteDialog}>
                    {saving ? t('common:saving') : t(key('deactivateInsteadButton'))}
                  </Button>
                ) : (
                  <Button variant="destructive" disabled={saving} onClick={handleConfirmDelete}>
                    {saving ? t('common:saving') : t(key('confirmDeleteButton'))}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
