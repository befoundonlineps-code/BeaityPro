import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import NumberField from '@/components/ui/NumberField'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export default function BalanceDialog({ open, type, onOpenChange, onSubmit }) {
  const { t } = useTranslation('common')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const title = type === 'credit' ? t('balanceDialog.creditTitle') : t('balanceDialog.debitTitle')

  function handleOpenChange(next) {
    if (!next) {
      setAmount('')
      setNote('')
      setError('')
    }
    onOpenChange(next)
  }

  async function handleSubmit() {
    setError('')
    const value = Number(amount)
    if (!amount || value <= 0) {
      setError(t('balanceDialog.invalidAmount'))
      return
    }
    setSaving(true)
    await onSubmit(value, note)
    setSaving(false)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="balance-amount">{t('balanceDialog.amountLabel')}</Label>
            <NumberField id="balance-amount" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="balance-note">{t('balanceDialog.noteLabel')}</Label>
            <Textarea id="balance-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{t('cancel')}</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? t('saving') : t('balanceDialog.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
