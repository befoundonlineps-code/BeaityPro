import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { exceptionWindowFor } from '../lib/employeeAvailability'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function timeRange(appointment) {
  const hhmm = (value) => {
    const d = new Date(value)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${hhmm(appointment.start_time)} – ${hhmm(appointment.end_time)}`
}

// The two decisions waiting on a provisional booking. Confirming also opens
// the employee's shift for that one day, which is shown here before it
// happens rather than left as a silent side effect.
export default function AppointmentActionsDialog({ open, onOpenChange, appointment, employee, clientName, serviceName, onDone }) {
  const { t } = useTranslation(['appointments', 'common'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) setError('')
  }, [open])

  if (!appointment) return null

  const window = exceptionWindowFor(new Date(appointment.start_time), new Date(appointment.end_time))

  async function handleConfirm() {
    setError('')
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('confirm_pending_appointment', {
      p_appointment_id: appointment.id,
      p_exception_date: window.date,
      p_start_time: window.startTime,
      p_end_time: window.endTime,
    })
    setBusy(false)
    if (rpcError) {
      setError(
        rpcError.message.includes('appointment_not_pending')
          ? t('appointments:pendingDialog.notPendingError')
          : rpcError.message
      )
      return
    }
    if (!data) {
      setError(t('appointments:pendingDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  async function handleCancel() {
    setError('')
    setBusy(true)
    const { data, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment.id)
      .select()
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    if (!data || data.length === 0) {
      setError(t('appointments:pendingDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  const rows = [
    [t('appointments:pendingDialog.clientLabel'), clientName],
    [t('appointments:pendingDialog.serviceLabel'), serviceName],
    [t('appointments:pendingDialog.employeeLabel'), employee?.name],
    [t('appointments:pendingDialog.timeLabel'), timeRange(appointment)],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('appointments:pendingDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {t('appointments:pendingDialog.banner')}
        </div>

        <dl className="flex flex-col gap-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t('appointments:pendingDialog.confirmEffect', {
            name: employee?.name || '',
            from: window.startTime.slice(0, 5),
            to: window.endTime.slice(0, 5),
          })}
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={handleCancel}>
            {t('appointments:pendingDialog.cancelButton')}
          </Button>
          <Button disabled={busy} onClick={handleConfirm}>
            {busy ? t('common:saving') : t('appointments:pendingDialog.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
