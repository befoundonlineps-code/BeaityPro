import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export default function BalanceDialog({ open, type, onOpenChange, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const title = type === 'credit' ? 'إضافة رصيد' : 'خصم من الرصيد'

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
      setError('أدخل مبلغ صحيح أكبر من صفر')
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
            <Label htmlFor="balance-amount">المبلغ (₪)</Label>
            <Input id="balance-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="balance-note">ملاحظة (اختياري)</Label>
            <Textarea id="balance-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>إلغاء</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? 'جاري الحفظ...' : 'تأكيد'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
