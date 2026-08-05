import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { exceptionWindowFor } from '../lib/employeeAvailability'
import { dbErrorSentence } from '../lib/dbErrors'
import { canRemoveParticipant, sortPrimaryFirst } from '../lib/participants'
import CancellationReasonManagerDialog from './CancellationReasonManagerDialog'
import TimeRange from './TimeRange'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pencil, UserMinus } from 'lucide-react'

// The actions available on a single appointment, gathered in one dialog so
// the calendar never has to open a different window depending on status.
// pending_approval gets confirm/cancel; booked gets cancel/didn't-show;
// everything else (completed, cancelled, no_show) is view-only.
export default function AppointmentActionsDialog({
  open, onOpenChange, appointment, employee, clientName, serviceName, sessionMembers,
  cancellationReasons, cancellationReasonsLoading, reloadCancellationReasons, salonId,
  // Which step to open on. Defaults to the view it has always opened on; the
  // calendar's card-level cancel passes 'cancelling' so the reason picker is
  // already showing, since the database will not accept a cancellation
  // without one.
  initialMode = 'view',
  onReschedule,
  onAdjustDuration,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const [mode, setMode] = useState('view') // 'view' | 'cancelling' | 'removing'
  const [removeTarget, setRemoveTarget] = useState(null)
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setRemoveTarget(null)
      setReasonId('')
      setError('')
    }
  }, [open, appointment?.id, initialMode])

  if (!appointment) return null

  const status = appointment.status
  const activeReasons = (cancellationReasons || []).filter((r) => r.is_active)
  // The whole session, the clicked row included, so the roster reads the
  // same whichever block on the calendar opened this.
  const members = sortPrimaryFirst(sessionMembers)

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
        dbErrorSentence(rpcError, t, 'confirmPendingAppointment')
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
        dbErrorSentence(rpcError, t, 'cancelAppointment')
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
      setError(dbErrorSentence(updateError, t, 'markNoShow'))
      return
    }
    if (!data || data.length === 0) {
      setError(t('appointments:actionsDialog.noRowsError'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  // Removal is cancellation scoped to one row: the same two writes the
  // whole session gets, applied to a single participant. The rest of the
  // session carries on, and the freed time reopens immediately because the
  // overlap constraint stops counting a cancelled row.
  async function handleRemoveConfirm() {
    if (!reasonId || !removeTarget) return
    setError('')
    setBusy(true)
    const { data, error: rpcError } = await supabase.rpc('remove_participant', {
      p_appointment_id: removeTarget.id,
      p_cancellation_reason_id: reasonId,
    })
    setBusy(false)
    if (rpcError) {
      setError(
        dbErrorSentence(rpcError, t, 'removeParticipant')
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
    // A node rather than a string: the row renderer below has no idea which
    // of its values is a range, and the range knows what it needs.
    //
    // ⚠️ react/jsx-key is wrong here and the disable is deliberate. The rule
    // sees JSX inside an array literal and assumes an array of children. This
    // is an array of [label, value] TUPLES; the element is a value rendered
    // into <dd>{value}</dd>, and the sibling that actually needs a key is the
    // mapped <div key={label}> below. Adding a key to satisfy the rule would
    // be a prop that means nothing.
    [t('appointments:actionsDialog.timeLabel'),
      // eslint-disable-next-line react/jsx-key
      <TimeRange start={appointment.start_time} end={appointment.end_time} />],
  ]

  const title = status === 'pending_approval'
    ? t('appointments:actionsDialog.pendingTitle')
    : t('appointments:actionsDialog.bookedTitle')

  const stepTitle = mode === 'cancelling'
    ? t('appointments:actionsDialog.cancelStep.title')
    : mode === 'removing'
    ? t('appointments:actionsDialog.removeStep.title')
    : title

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{stepTitle}</DialogTitle>
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
              only one name would make that look like a bug.

              Removal is the one exception, so it lives here rather than in
              the footer — beside the person it takes off, not beside the
              buttons that move everybody. */}
          {members.length > 1 && mode === 'view' && (
            <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">
                {t('appointments:actionsDialog.sessionMembersLabel')}
              </span>
              {members.map((m) => (
                <div key={m.id} className="flex min-h-8 items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{m.employeeName}</span>
                    <span className="ms-1.5 text-xs text-muted-foreground">
                      {t(m.is_primary
                        ? 'appointments:actionsDialog.primaryBadge'
                        : 'appointments:actionsDialog.participantBadge')}
                    </span>
                  </span>
                  {canRemoveParticipant(m) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      title={t('appointments:actionsDialog.removeParticipantTitle')}
                      onClick={() => {
                        setRemoveTarget(m)
                        setReasonId('')
                        setError('')
                        setMode('removing')
                      }}
                    >
                      <UserMinus />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {mode === 'removing' && (
            <>
              <div className="text-sm font-medium">
                {t('appointments:actionsDialog.removeStep.question', { name: removeTarget?.employeeName || '' })}
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t('appointments:actionsDialog.removeStep.effect')}
              </div>
            </>
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

          {/* One picker for both steps — removal reuses the cancellation
              list because a removed row *is* a cancelled row, and the
              biconditional check makes cancellation_reason_id the only
              column it can be recorded in. A fifth reasons table would say
              the same thing twice. */}
          {(mode === 'cancelling' || mode === 'removing') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <select
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  autoFocus
                >
                  <option value="">
                    {t(mode === 'removing'
                      ? 'appointments:actionsDialog.removeStep.reasonPlaceholder'
                      : 'appointments:actionsDialog.cancelStep.reasonPlaceholder')}
                  </option>
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
            {mode === 'removing' ? (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => { setMode('view'); setRemoveTarget(null); setError('') }}
                >
                  {t('appointments:actionsDialog.removeStep.backButton')}
                </Button>
                <Button variant="destructive" disabled={busy || !reasonId} onClick={handleRemoveConfirm}>
                  {busy ? t('common:saving') : t('appointments:actionsDialog.removeStep.confirmButton')}
                </Button>
              </>
            ) : mode === 'cancelling' ? (
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
