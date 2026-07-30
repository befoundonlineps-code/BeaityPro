import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { exceptionWindowFor } from '../lib/employeeAvailability'
import CancellationReasonManagerDialog from './CancellationReasonManagerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

function timeRange(appointment) {
  const hhmm = (value) => {
    const d = new Date(value)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${hhmm(appointment.start_time)} – ${hhmm(appointment.end_time)}`
}

// The actions available on a single appointment, gathered in one dialog so
// the calendar never has to open a different window depending on status.
// pending_approval gets confirm/cancel; booked gets cancel/didn't-show;
// everything else (completed, cancelled, no_show) is view-only.
export default function AppointmentActionsDialog({
  open, onOpenChange, appointment, employee, clientName, serviceName, groupMemberNames,
  cancellationReasons, cancellationReasonsLoading, reloadCancellationReasons, salonId,
  onReschedule,
  onAdjustDuration,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const [mode, setMode] = useState('view') // 'view' | 'cancelling'
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setMode('view')
      setReasonId('')
      setError('')
    }
  }, [open, appointment?.id])

  if (!appointment) return null

  const status = appointment.status
  const activeReasons = (cancellationReasons || []).filter((r) => r.is_active)

  async function handleConfirm() {
    setError('')
    setBusy(true)
    const window = exceptionWindowFor(new Date(appointment.start_time), new Date(appointment.end_time))
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
          ? t('appointments:actionsDialog.notPendingError')
          : rpcError.message
      )
      return
    }
    if (!data) {
      setError(t('appointments:actionsDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  async function handleCancelConfirm() {
    if (!reasonId) return
    setError('')
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: appointment.id,
      p_cancellation_reason_id: reasonId,
    })
    setBusy(false)
    if (rpcError) {
      setError(
        rpcError.message.includes('appointment_not_cancellable')
          ? t('appointments:actionsDialog.notCancellableError')
          : rpcError.message
      )
      return
    }
    if (!data) {
      setError(t('appointments:actionsDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  async function handleNoShow() {
    setError('')
    setBusy(true)
    const { data, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'no_show' })
      .eq('id', appointment.id)
      .select()
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    if (!data || data.length === 0) {
      setError(t('appointments:actionsDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  function handleReschedule() {
    onOpenChange(false)
    onReschedule(appointment)
  }

  function handleAdjustDuration() {
    onOpenChange(false)
    onAdjustDuration(appointment)
  }

  // Only a session that has actually begun can have its real end recorded.
  // Before it starts there is nothing to adjust — moving it is what
  // "reschedule" is for.
  const hasStarted = new Date(appointment.start_time) <= new Date()

  const rows = [
    [t('appointments:actionsDialog.clientLabel'), clientName],
    [t('appointments:actionsDialog.serviceLabel'), serviceName],
    [t('appointments:actionsDialog.employeeLabel'), employee?.name],
    [t('appointments:actionsDialog.timeLabel'), timeRange(appointment)],
  ]

  const title = status === 'pending_approval'
    ? t('appointments:actionsDialog.pendingTitle')
    : t('appointments:actionsDialog.bookedTitle')

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'cancelling' ? t('appointments:actionsDialog.cancelStep.title') : title}</DialogTitle>
          </DialogHeader>

          {status === 'pending_approval' && mode === 'view' && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {t('appointments:actionsDialog.banner')}
            </div>
          )}

          <dl className="flex flex-col gap-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Named because every action here applies to the whole session:
              cancelling from this block clears the others too, and seeing
              only one name would make that look like a bug. */}
          {(groupMemberNames || []).length > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t('appointments:actionsDialog.alsoOnSessionLabel')}</span>
              {' '}
              <span className="font-medium">{groupMemberNames.join('، ')}</span>
            </div>
          )}

          {mode === 'view' && status === 'pending_approval' && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t('appointments:actionsDialog.confirmEffect', {
                name: employee?.name || '',
                from: exceptionWindowFor(new Date(appointment.start_time), new Date(appointment.end_time)).startTime.slice(0, 5),
                to: exceptionWindowFor(new Date(appointment.start_time), new Date(appointment.end_time)).endTime.slice(0, 5),
              })}
            </div>
          )}

          {mode === 'cancelling' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  autoFocus
                >
                  <option value="">{t('appointments:actionsDialog.cancelStep.reasonPlaceholder')}</option>
                  {activeReasons.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title={t('appointments:actionsDialog.cancelStep.manageReasonsTitle')}
                  onClick={() => setReasonManagerOpen(true)}
                >
                  <Pencil />
                </Button>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* Buttons swap by mode/status rather than stacking, so there is
              never more than one obvious next step in the footer. */}
          <DialogFooter>
            {mode === 'cancelling' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setMode('view')}>
                  {t('appointments:actionsDialog.cancelStep.backButton')}
                </Button>
                <Button variant="destructive" disabled={busy || !reasonId} onClick={handleCancelConfirm}>
                  {busy ? t('common:saving') : t('appointments:actionsDialog.cancelStep.confirmButton')}
                </Button>
              </>
            ) : status === 'pending_approval' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setMode('cancelling')}>
                  {t('appointments:actionsDialog.cancelButton')}
                </Button>
                <Button variant="outline" disabled={busy} onClick={handleReschedule}>
                  {t('appointments:actionsDialog.rescheduleButton')}
                </Button>
                <Button disabled={busy} onClick={handleConfirm}>
                  {busy ? t('common:saving') : t('appointments:actionsDialog.confirmButton')}
                </Button>
              </>
            ) : status === 'booked' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={handleNoShow}>
                  {t('appointments:actionsDialog.noShowButton')}
                </Button>
                {hasStarted && (
                  <Button variant="outline" disabled={busy} onClick={handleAdjustDuration}>
                    {t('appointments:actionsDialog.adjustDurationButton')}
                  </Button>
                )}
                <Button variant="outline" disabled={busy} onClick={handleReschedule}>
                  {t('appointments:actionsDialog.rescheduleButton')}
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => setMode('cancelling')}>
                  {t('appointments:actionsDialog.cancelButton')}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('appointments:actionsDialog.closeButton')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancellationReasonManagerDialog
        open={reasonManagerOpen}
        onOpenChange={setReasonManagerOpen}
        reasons={cancellationReasons}
        loading={cancellationReasonsLoading}
        onChanged={reloadCancellationReasons}
        salonId={salonId}
      />
    </>
  )
}
