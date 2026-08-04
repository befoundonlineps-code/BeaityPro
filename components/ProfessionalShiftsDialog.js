import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { shiftSummary } from '../lib/shiftSummary'
import { User, TriangleAlert, Clock } from 'lucide-react'
import { classifyBulkRelease, releaseWindow } from '../lib/bulkRelease'
import { loadReleaseCandidates, markEmployeeAbsent, clearEmployeeAbsence } from '../lib/bulkReleaseIO'
import { getAvatarColor } from '../lib/avatarColor'
import { setEmployeeDayHours, clearEmployeeDayHours } from '../lib/dayHoursIO'
import { availableWindowsForDate, dayHoursForDate } from '../lib/employeeAvailability'
import { dbErrorSentence } from '../lib/dbErrors'
import ReleasePreviewList from './ReleasePreviewList'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// The general way in to one professional's standing on the day on screen.
//
// EmployeeDayDialog answers the same question from a column header, where the
// person is already decided. This one is reached from the toolbar, so it
// carries its own picker and can be opened when nobody in particular is being
// looked at — which is exactly when a receptionist taking a phone call needs
// it.
//
// It is a second door, not a second implementation: the reasons come from the
// same absence_reasons list, the affected bookings from the same preview, and
// the write from the same mark_employee_absent.
export default function ProfessionalShiftsDialog({
  open, onOpenChange, employees, dateISO, initialEmployeeId, salonId,
  absencesByEmployee, absenceReasons,
  schedulesByEmployee, exceptionsByEmployee, dayHoursByEmployee,
  clientsById, servicesById, employeesById, onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const router = useRouter()

  const [employeeId, setEmployeeId] = useState('')
  const [working, setWorking] = useState(true)
  const [reasonId, setReasonId] = useState('')
  const [plan, setPlan] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Editing hours is a separate act from marking somebody off, so it has its
  // own toggle rather than sharing the Work tickbox: "she is in, just later
  // today" and "she is not in" are different answers and must not be reachable
  // by the same control.
  const [editingHours, setEditingHours] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [outsideCount, setOutsideCount] = useState(null)

  const activeReasons = useMemo(
    () => (absenceReasons || []).filter((r) => r.is_active),
    [absenceReasons]
  )

  // The absence already recorded for whoever is picked, on the day on screen.
  const currentAbsence = useMemo(() => {
    if (!employeeId) return null
    return ((absencesByEmployee || {})[employeeId] || []).find((a) => a.absence_date === dateISO) || null
  }, [absencesByEmployee, employeeId, dateISO])

  useEffect(() => {
    if (!open) return
    setEmployeeId(initialEmployeeId || '')
    setPlan(null)
    setVerifying(false)
    setBusy(false)
    setError('')
  }, [open, initialEmployeeId, dateISO])

  // The tickbox and the reason follow whoever is picked, so switching
  // professionals inside the dialog shows their standing rather than the
  // previous one's.
  useEffect(() => {
    setWorking(!currentAbsence)
    setReasonId(currentAbsence ? currentAbsence.absence_reason_id : '')
    setPlan(null)
    setVerifying(false)
    setError('')
  }, [currentAbsence, employeeId])

  function reasonColor(id) {
    return (absenceReasons || []).find((r) => r.id === id)?.color || getAvatarColor(id)
  }

  const dayDate = useMemo(() => new Date(`${dateISO}T00:00:00`), [dateISO])
  const employeeHours = employeeId ? (dayHoursByEmployee || {})[employeeId] : null
  const override = dayHoursForDate(employeeHours, dayDate)

  // What the day currently comes to, through the one central function — so
  // the hours shown here are the hours the calendar draws, not a second
  // opinion assembled from the same parts.
  const currentWindows = useMemo(() => {
    if (!employeeId) return []
    const entry = (schedulesByEmployee || {})[employeeId]
    return availableWindowsForDate(
      entry?.schedule,
      entry?.slots,
      (exceptionsByEmployee || {})[employeeId],
      dayDate,
      (absencesByEmployee || {})[employeeId],
      employeeHours
    )
  }, [employeeId, schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, employeeHours, dayDate])

  // Opening the editor starts from whatever the day already comes to, so
  // "start at eleven instead of nine" is one field changed rather than two
  // typed from nothing.
  useEffect(() => {
    setEditingHours(false)
    setOutsideCount(null)
    const first = currentWindows[0]
    setStartTime(first ? first.startTime : '')
    setEndTime(first ? first.endTime : '')
  }, [employeeId, dateISO, currentWindows.length])

  // Bookings that would fall outside the hours being typed. Counted, not
  // moved: narrowing a day is not an absence, nothing in the database ties a
  // booking to a shift window, and a session already agreed with a client
  // stays agreed. The receptionist is told, and decides.
  async function checkOutside() {
    setOutsideCount(null)
    if (!startTime || !endTime || endTime <= startTime) return
    const { from, to } = releaseWindow(dateISO, dateISO)
    const { rows } = await loadReleaseCandidates({
      target: { kind: 'employee', employeeId }, from, to,
    })
    const hhmm = (value) => {
      const d = new Date(value)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    setOutsideCount((rows || []).filter((a) => hhmm(a.start_time) < startTime || hhmm(a.end_time) > endTime).length)
  }

  async function handleSaveHours() {
    if (!employeeId || !startTime || !endTime || endTime <= startTime) return
    setError('')
    setBusy(true)
    const { error: saveError } = await setEmployeeDayHours({
      salonId, employeeId, dateISO, startTime, endTime,
    })
    setBusy(false)
    if (saveError) {
      setError(dbErrorSentence(saveError, t, 'setEmployeeDayHours'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  async function handleResetHours() {
    setError('')
    setBusy(true)
    const { error: deleteError } = await clearEmployeeDayHours({ employeeId, dateISO })
    setBusy(false)
    if (deleteError) {
      setError(dbErrorSentence(deleteError, t, 'clearEmployeeDayHours'))
      return
    }
    onDone()
    onOpenChange(false)
  }

  const wasAbsent = !!currentAbsence
  const marking = !working && !wasAbsent    // going off
  const clearing = working && wasAbsent     // coming back
  const canApply = !!employeeId && (clearing || (marking && !!reasonId))

  async function handleApply() {
    if (!canApply) return
    setError('')

    if (clearing) {
      setBusy(true)
      const { error: deleteError } = await clearEmployeeAbsence({ employeeId, dateISO })
      setBusy(false)
      if (deleteError) {
        setError(dbErrorSentence(deleteError, t, 'clearEmployeeAbsence'))
        return
      }
      onDone()
      onOpenChange(false)
      return
    }

    // Look before promising: the second window only appears when there is
    // something to warn about, so a professional with an empty day is marked
    // off in one press.
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const target = { kind: 'employee', employeeId }
    const { rows, error: loadError } = await loadReleaseCandidates({ target, from, to })
    setBusy(false)
    if (loadError) {
      setError(dbErrorSentence(loadError, t, 'loadReleaseCandidates'))
      return
    }

    const next = classifyBulkRelease({ appointments: rows, target, cutoff: new Date() })
    if (next.toCancel.length + next.toRemove.length === 0) {
      await commit()
      return
    }
    setPlan(next)
    setVerifying(true)
  }

  async function commit() {
    setError('')
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const { error: rpcError } = await markEmployeeAbsent({
      employeeId, dateISO, absenceReasonId: reasonId, from, to,
    })
    setBusy(false)

    if (rpcError) {
      // appointment_not_cancellable means something different here than in the
      // actions dialog: somebody is releasing a whole day, and a booking that
      // moved underneath them is stale news rather than a refusal.
      setError(dbErrorSentence(rpcError, t, 'markEmployeeAbsent', {
        appointment_not_cancellable: 'appointments:dayStatus.staleError',
      }))
      setVerifying(false)
      return
    }

    onDone()
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('appointments:shiftsDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Label className="w-24 shrink-0">{t('appointments:shiftsDialog.professionalLabel')}</Label>
              <div className="flex flex-1 items-center gap-1.5">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <select
                  className={SELECT_CLASS}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">{t('appointments:shiftsDialog.selectPlaceholder')}</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="accent-primary"
                checked={working}
                disabled={!employeeId || busy}
                onChange={(e) => setWorking(e.target.checked)}
              />
              {t('appointments:shiftsDialog.workLabel')}
            </label>

            {/* The reason only exists while somebody is being marked off, so
                it appears under the tickbox that caused it rather than sitting
                there greyed out. */}
            {!working && (
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0" />
                <div className="flex flex-1 items-center gap-1.5">
                  {/* The reason's own colour when it has one, and a stable
                      derived one when it does not — a reason somebody adds
                      from the manager dialog still gets a swatch rather than
                      an empty square. */}
                  <span
                    className="size-3 shrink-0 rounded-sm border border-border"
                    style={{ background: reasonId ? reasonColor(reasonId) : 'transparent' }}
                  />
                  <select
                    className={SELECT_CLASS}
                    value={reasonId}
                    onChange={(e) => setReasonId(e.target.value)}
                    disabled={wasAbsent}
                    autoFocus
                  >
                    <option value="">{t('appointments:shiftsDialog.noReason')}</option>
                    {activeReasons.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {wasAbsent && working && (
              <p className="text-sm text-muted-foreground">{t('appointments:dayStatus.clearHint')}</p>
            )}

            {/* Hours for this one day. Only offered while she is in — there
                are no hours to set for a day somebody is not coming in. */}
            {working && !wasAbsent && employeeId && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Clock className="size-4 text-muted-foreground" />
                    {/* The same sentence the toolbar button shows, from the
                        same function, so the two never disagree about a day. */}
                    {shiftSummary(currentWindows, router.locale || 'ar')
                      || t('appointments:shiftsDialog.noHoursToday')}
                  </span>
                  {!editingHours && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingHours(true)}>
                      {t('appointments:shiftsDialog.editHoursButton')}
                    </Button>
                  )}
                </div>

                {override && !editingHours && (
                  <span className="text-xs text-muted-foreground">
                    {t('appointments:shiftsDialog.overrideNotice')}
                  </span>
                )}

                {editingHours && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{t('appointments:shiftsDialog.startLabel')}</Label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => { setStartTime(e.target.value); setOutsideCount(null) }}
                          onBlur={checkOutside}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-xs">{t('appointments:shiftsDialog.endLabel')}</Label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => { setEndTime(e.target.value); setOutsideCount(null) }}
                          onBlur={checkOutside}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {t('appointments:shiftsDialog.oneDayOnlyNotice')}
                    </p>

                    {/* Told, not acted on: a booking outside the new hours is
                        still a booking somebody agreed to. */}
                    {outsideCount > 0 && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                        <span>{t('appointments:shiftsDialog.bookingsOutsideNotice', { count: outsideCount })}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {override && (
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleResetHours}>
                          {t('appointments:shiftsDialog.resetHoursButton')}
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditingHours(false)}>
                        {t('appointments:shiftsDialog.cancelHoursButton')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || !startTime || !endTime || endTime <= startTime}
                        onClick={handleSaveHours}
                      >
                        {busy ? t('common:saving') : t('appointments:shiftsDialog.saveHoursButton')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button disabled={busy || !canApply} onClick={handleApply}>
              {busy ? t('common:saving') : t('appointments:shiftsDialog.changeButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A second window over the first rather than a step inside it: the
          question changed from "what shall I record?" to "do you really mean
          to clear these?", and closing it should put the first one back
          exactly as it was.

          Returning to editing is the filled button even though it is the
          cautious one. The dangerous choice being the most inviting is how
          somebody clears a day they meant to look at first. */}
      <Dialog open={verifying} onOpenChange={(next) => { if (!next) setVerifying(false) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('appointments:shiftsDialog.verificationTitle')}</DialogTitle>
          </DialogHeader>

          <p className="text-sm">
            {t('appointments:shiftsDialog.verificationIntro', {
              name: employeesById[employeeId]?.name || '',
            })}
          </p>

          <ReleasePreviewList
            plan={plan}
            clientsById={clientsById}
            servicesById={servicesById}
            employeesById={employeesById}
          />

          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{t('appointments:dayStatus.noUndoWarning')}</span>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={commit}>
              {busy ? t('common:saving') : t('appointments:shiftsDialog.continueAnywayButton')}
            </Button>
            <Button disabled={busy} onClick={() => setVerifying(false)}>
              {t('appointments:shiftsDialog.returnToEditingButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
