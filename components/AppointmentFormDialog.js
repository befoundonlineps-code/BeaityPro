import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { availableWindowsForDate, isAbsentOn } from '../lib/employeeAvailability'
import { servicesForRole } from '../lib/roleServiceFilter'
import { serviceUsesResources, orderedUnitsForService, availableUnitsFor } from '../lib/resourceAllocation'
import { resolvePlacementWindow, evaluatePlacement, isServiceAllowedForRole, combineGroupPlacement } from '../lib/bookingPlacement'
import { loadOccupancy, loadGroupOccupancy, attemptOnEachUnit } from '../lib/placementIO'
import { dbErrorSentence } from '../lib/dbErrors'
import { cn } from '@/lib/utils'
import { Plus, X, Minus, Clock, UserRound, Bold, Italic, Underline, Palette } from 'lucide-react'
import { useRouter } from 'next/router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAvatarColor, getInitials } from '../lib/avatarColor'
import { useClientSearch } from '../hooks/useClientSearch'
import ServicePickerPanel from './ServicePickerPanel'
import TimeRange from './TimeRange'
import { bookingTotal } from '../lib/servicePicker'

// Which message each refusal from the pure layer turns into.
const PLACEMENT_ERROR_KEYS = {
  roleMismatch: 'appointments:formDialog.roleMismatchError',
  conflict: 'appointments:formDialog.conflictError',
  resourcesBusy: 'appointments:formDialog.allResourcesBusyError',
}

// The one select style this dialog uses, written once instead of pasted onto
// every field.
const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// Shape only: the note is stored as plain text and these do not change that.
const FORMAT_BUTTONS = [['bold', Bold], ['italic', Italic], ['underline', Underline], ['color', Palette]]

function toDateInputValue(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInputValue(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// waitingAppointment turns this into conversion mode: the same dialog, but
// filling in a waiting-list entry that already exists rather than creating
// something new. The client is fixed (a different client would be somebody
// else's place in the queue), the service is not, and every placement rule
// runs exactly as it does for a fresh booking — only the final write
// differs, updating the row in place instead of inserting one.
export default function AppointmentFormDialog({ open, onOpenChange, salonId, initialEmployeeId, initialStartTime, waitingAppointment, employees, services, categories, roleBusinessTypes, schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, dayHoursByEmployee, resources, resourceUnits, serviceResources, onSaved }) {
  const { t } = useTranslation(['appointments', 'employees', 'services', 'clientsList', 'common'])

  const [client, setClient] = useState(null)
  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)
  // Set when the requested time falls outside the employee's shift. Booking
  // then isn't refused — the receptionist is asked whether to hold the slot
  // provisionally and get it approved later.
  const [outsideSchedule, setOutsideSchedule] = useState(null)
  // Extra professionals on the same session. Each becomes its own
  // appointment row sharing a group_id, so each one's time is protected by
  // the very same exclusion constraint the main professional's is.
  const [extraEmployeeIds, setExtraEmployeeIds] = useState([])
  // Every shape on this screen with nothing behind it opens the same notice.
  const [placeholderNotice, setPlaceholderNotice] = useState(false)
  const [currentUser, setCurrentUser] = useState('')
  const { search: clientSearch, setSearch: setClientSearch, results: clientResults } = useClientSearch()
  const router = useRouter()

  function showsPlaceholderNotice() {
    setPlaceholderNotice(true)
  }

  const isConverting = !!waitingAppointment
  const activeServices = (services || []).filter((s) => s.is_active)
  const selectedEmployee = (employees || []).find((e) => e.id === employeeId)
  const selectedService = activeServices.find((s) => s.id === serviceId)
  const visibleServices = servicesForRole(selectedEmployee?.role, activeServices, categories, roleBusinessTypes)

  // Anyone whose role covers the chosen service, minus the people already on
  // it. is_assistant plays no part here: it hides a calendar column, it does
  // not limit who may work.
  const eligibleExtras = selectedService
    ? (employees || []).filter(
        (e) =>
          e.id !== employeeId &&
          isServiceAllowedForRole(e.role, selectedService, activeServices, categories, roleBusinessTypes)
      )
    : []

  // Whoever is still free to be added, and why the button is off when it is.
  const remainingExtras = eligibleExtras.filter((emp) => !extraEmployeeIds.includes(emp.id))
  const canAddProfessional = !!selectedService && remainingExtras.length > 0
  const addProfessionalHint = !selectedService
    ? t('appointments:formDialog.addProfessionalNeedsServiceHint')
    : remainingExtras.length === 0
    ? t('appointments:formDialog.addProfessionalNoneLeftHint')
    : t('appointments:formDialog.addProfessionalButton')

  function handleEmployeeChange(newEmployeeId) {
    setEmployeeId(newEmployeeId)
    const newEmployee = (employees || []).find((e) => e.id === newEmployeeId)
    const newVisible = servicesForRole(newEmployee?.role, activeServices, categories, roleBusinessTypes)
    if (serviceId && !newVisible.some((s) => s.id === serviceId)) {
      setServiceId('')
    }
    // Whoever just became the main professional can't also be an extra.
    setExtraEmployeeIds((prev) => prev.filter((id) => id !== newEmployeeId))
  }

  function handleServiceChange(newServiceId) {
    setServiceId(newServiceId)
    // A different service can mean a different set of qualified roles, so
    // anyone who no longer covers it drops off rather than failing on save.
    const newService = activeServices.find((s) => s.id === newServiceId)
    setExtraEmployeeIds((prev) =>
      prev.filter((id) => {
        const emp = (employees || []).find((e) => e.id === id)
        return newService && isServiceAllowedForRole(emp?.role, newService, activeServices, categories, roleBusinessTypes)
      })
    )
  }

  useEffect(() => {
    if (!open) return
    setError('')
    setRemaining(null)
    setOutsideSchedule(null)
    setExtraEmployeeIds([])
    setEmployeeId(initialEmployeeId || '')
    setDate(initialStartTime ? toDateInputValue(initialStartTime) : '')
    setTime(initialStartTime ? toTimeInputValue(initialStartTime) : '')

    // Converting carries the entry's own client, service and note across;
    // the waiting toggle is meaningless here, since this is the way *out*
    // of the waiting list.
    setClient(waitingAppointment ? waitingAppointment.client || null : null)
    setServiceId(waitingAppointment ? waitingAppointment.service_id || '' : '')
    setNote(waitingAppointment ? waitingAppointment.note || '' : '')
    setIsWaiting(false)
  }, [open, initialEmployeeId, initialStartTime, waitingAppointment])

  // The warning belongs to one specific employee/service/time combination.
  // Touching any of them makes it stale, so it goes away and has to be
  // earned again on the next save.
  useEffect(() => { setOutsideSchedule(null) }, [employeeId, serviceId, date, time, isWaiting, extraEmployeeIds])

  const computedEndTime = selectedService && date && time
    ? new Date(new Date(`${date}T${time}:00`).getTime() + selectedService.duration_minutes * 60000)
    : null

  const clientName = client ? `${client.first_name} ${client.last_name || ''}`.trim() : ''

  const dateLabel = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(router.locale || 'ar', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : ''

  // Decoration: appointments carry created_at and no created_by, so this says
  // who is filling the form in and is never written anywhere.
  const nowLabel = new Date().toLocaleString(router.locale || 'ar', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUser(data?.user?.email || '')
    })
    return () => { cancelled = true }
  }, [open])

  // "X remaining" for the exact window being booked — recomputed whenever
  // the service or the time changes, and only for services that actually
  // use resources.
  useEffect(() => {
    let cancelled = false

    async function computeRemaining() {
      if (isWaiting || !selectedService || !date || !time || !serviceUsesResources(serviceId, serviceResources)) {
        setRemaining(null)
        return
      }
      // Same resolved window the save will use, so the count reflects what
      // actually gets booked rather than the slot boundary on screen.
      const placement = resolvePlacementWindow(new Date(`${date}T${time}:00`), selectedService, new Date())
      if (!placement) {
        setRemaining(null)
        return
      }
      const { start, end } = placement
      const ordered = orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
      const { unitRows, error: queryError } = await loadOccupancy({ employeeId: null, start, end })
      if (cancelled || queryError) return
      setRemaining({ free: availableUnitsFor(ordered, unitRows, start, end).length, total: ordered.length })
    }

    computeRemaining()
    return () => { cancelled = true }
  }, [serviceId, date, time, isWaiting, serviceResources, resources, resourceUnits])

  // asPending is set only by the "book provisionally" button, which the
  // receptionist reaches after being warned. It skips the shift check —
  // that check is the very thing she just answered — and nothing else.
  async function handleSave(asPending = false) {
    setError('')

    if (!client) {
      setError(t('appointments:formDialog.clientRequiredError'))
      return
    }
    if (!serviceId) {
      setError(t('appointments:formDialog.serviceRequiredError'))
      return
    }

    if (isWaiting) {
      setSaving(true)
      // A waiting entry is a group of one, exactly like a booked primary.
      // group_id is NOT NULL with no default — a column default cannot
      // reference the row's own id — so it has to be generated here, the
      // same way the booking path below does it.
      const waitingId = crypto.randomUUID()
      const { data, error: saveError } = await supabase
        .from('appointments')
        .insert([{
          id: waitingId,
          salon_id: salonId,
          client_id: client.id,
          service_id: serviceId,
          employee_id: null,
          start_time: null,
          end_time: null,
          status: 'waiting',
          note: note.trim() || null,
          group_id: waitingId,
          is_primary: true,
        }])
        .select()
      setSaving(false)
      if (saveError) {
        setError(dbErrorSentence(saveError, t, 'createWaitingEntry'))
        return
      }
      if (!data || data.length === 0) {
        setError(t('appointments:formDialog.noRowsError'))
        return
      }
      onSaved()
      onOpenChange(false)
      return
    }

    if (!employeeId) {
      setError(t('appointments:formDialog.employeeRequiredError'))
      return
    }
    if (!date || !time) {
      setError(t('appointments:formDialog.dateTimeRequiredError'))
      return
    }

    // Resolve against the clock as it is right now, not as it was when the
    // dialog opened — a booking that sat unsaved for a few minutes should
    // record when it actually starts. Everything below checks the resolved
    // window, so a service that no longer fits before closing is caught.
    const placement = resolvePlacementWindow(new Date(`${date}T${time}:00`), selectedService, new Date())
    if (!placement) {
      setError(t('appointments:formDialog.pastTimeError'))
      return
    }
    const { start, end } = placement

    setSaving(true)

    // A row left on the placeholder is simply not a participant yet.
    const participantIds = [employeeId, ...extraEmployeeIds.filter(Boolean)]

    // An absence is refused outright rather than turned into the
    // "book provisionally?" question the rest of this dialog asks. That
    // question means "she is outside her shift — shall we ask her to come
    // in?", and there is nobody to ask: she is not here today. The grid
    // already makes her cells inert, so this only catches the way in through
    // the employee dropdown.
    const absentId = participantIds.find((id) => isAbsentOn((absencesByEmployee || {})[id], start))
    if (absentId) {
      setSaving(false)
      setError(t('appointments:formDialog.absentEmployeeError', {
        name: (employees || []).find((e) => e.id === absentId)?.name || '',
      }))
      return
    }
    const { rowsByEmployee, unitRows, error: loadError } = await loadGroupOccupancy({
      employeeIds: participantIds,
      start,
      end,
    })
    if (loadError) {
      setSaving(false)
      setError(loadError.message)
      return
    }

    // Every participant goes through the very same evaluatePlacement as a
    // lone booking, once each. Only the main professional can claim a
    // resource unit — the room follows the client's session, not each pair
    // of hands in it — so the others are evaluated with no units at all.
    const dayStart = new Date(`${date}T00:00:00`)
    const entries = participantIds.map((id, index) => {
      const employee = (employees || []).find((e) => e.id === id)
      const scheduleEntry = (schedulesByEmployee || {})[id]
      const isPrimary = index === 0
      return {
        key: id,
        employeeName: employee?.name || '',
        isPrimary,
        plan: evaluatePlacement({
          start,
          end,
          windows: availableWindowsForDate(
            scheduleEntry?.schedule,
            scheduleEntry?.slots,
            (exceptionsByEmployee || {})[id],
            dayStart,
            (absencesByEmployee || {})[id],
            (dayHoursByEmployee || {})[id]
          ),
          roleAllowed: isServiceAllowedForRole(employee?.role, selectedService, activeServices, categories, roleBusinessTypes),
          employeeAppointments: rowsByEmployee[id] || [],
          orderedUnits: isPrimary && serviceUsesResources(serviceId, serviceResources)
            ? orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
            : [],
          unitAppointments: unitRows,
        }),
      }
    })

    const group = combineGroupPlacement(entries)

    if (!group.ok) {
      setSaving(false)
      const { reason, failed } = group
      if (!failed.isPrimary && (reason === 'conflict' || reason === 'roleMismatch')) {
        // Name the person: with several on one session, "the employee is
        // busy" would leave the receptionist guessing which one.
        setError(t(`appointments:formDialog.participant.${reason}Error`, { name: failed.employeeName }))
      } else {
        setError(t(PLACEMENT_ERROR_KEYS[reason]))
      }
      return
    }

    // Outside the shift is a question, not a refusal — unless it has already
    // been asked and answered by the "book provisionally" button. A session
    // can be mixed: whoever is on shift books outright, whoever is not is
    // held pending approval.
    if (group.outsideKeys.length > 0 && !asPending) {
      setSaving(false)
      setOutsideSchedule({
        names: group.outsideKeys
          .map((id) => (employees || []).find((e) => e.id === id)?.name || '')
          .filter(Boolean)
          .join('، '),
      })
      return
    }
    setOutsideSchedule(null)

    const outside = new Set(group.outsideKeys)
    const statusFor = (id) => (outside.has(id) ? 'pending_approval' : 'booked')

    // Converting fills in a row that already exists, so it updates in place
    // rather than inserting: the entry keeps its id and its created_at, and
    // "how long did this client wait?" stays answerable afterwards. The
    // function refuses if the entry stopped being `waiting` in the
    // meantime, which is what stops two devices converting the same one.
    if (isConverting) {
      const { data, error: saveError, kind, exhausted } = await attemptOnEachUnit(
        entries[0].plan.candidateUnits,
        (unit) => supabase.rpc('convert_waiting_appointment', {
          p_appointment_id: waitingAppointment.id,
          p_employee_id: employeeId,
          p_service_id: serviceId,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
          p_provisional: outside.has(employeeId),
          p_resource_unit_id: unit ? unit.id : null,
          p_participants: extraEmployeeIds.filter(Boolean).map((id) => ({
            employee_id: id,
            provisional: outside.has(id),
          })),
        })
      )

      setSaving(false)

      if (saveError) {
        if (exhausted) setError(t('appointments:formDialog.allResourcesBusyError'))
        else if (kind === 'employee') setError(t('appointments:formDialog.conflictError'))
        else setError(dbErrorSentence(saveError, t, 'convertWaitingAppointment'))
        return
      }
      if (!data) {
        setError(t('appointments:formDialog.noRowsError'))
        return
      }

      onSaved()
      onOpenChange(false)
      return
    }

    // The main professional's row carries its own id as group_id, which is
    // what makes the composite foreign key work without deferral: it exists
    // the moment the row does, and the others point at a row already there.
    const groupId = crypto.randomUUID()

    const groupRows = participantIds.map((id, index) => ({
      id: index === 0 ? groupId : crypto.randomUUID(),
      salon_id: salonId,
      client_id: client.id,
      service_id: serviceId,
      employee_id: id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: statusFor(id),
      note: note.trim() || null,
      group_id: groupId,
      is_primary: index === 0,
    }))

    // One insert for the whole session. Several rows in a single insert are
    // atomic in Postgres by nature — they all land or none do — so creating
    // a group needs no database function of its own, unlike cancelling or
    // rescheduling which have to update and insert together.
    const { data, error: saveError, kind, exhausted } = await attemptOnEachUnit(
      entries[0].plan.candidateUnits,
      (unit) => supabase
        .from('appointments')
        .insert(groupRows.map((row) => ({ ...row, resource_unit_id: row.is_primary && unit ? unit.id : null })))
        .select()
    )

    setSaving(false)

    if (saveError) {
      if (exhausted) setError(t('appointments:formDialog.allResourcesBusyError'))
      else if (kind === 'employee') setError(t('appointments:formDialog.conflictError'))
      else setError(dbErrorSentence(saveError, t, 'createBooking'))
      return
    }
    if (!data || data.length !== groupRows.length) {
      setError(t('appointments:formDialog.noRowsError'))
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Three columns at full width, the way the reference screen is laid
            out: who it is for, what is being booked, and what there is to
            book. Below lg they stack, because three 300px columns on a phone
            are one 900px column nobody can reach the end of. */}
        {/* flex, not the grid DialogContent defaults to. A grid row sizes to
            its content, so a category holding forty-six services made the
            middle row as tall as the list and pushed the footer past the
            clip — with overflow hidden, there was no scrollbar to reach it.
            A flex column lets the middle claim what is left and no more,
            which is what min-h-0 and flex-1 below have always assumed. */}
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[1400px]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {isConverting ? t('appointments:formDialog.convertTitle') : t('appointments:formDialog.title')}
              {/* Static: this database has one salon and no branches at all. */}
              <span className="text-sm font-normal text-muted-foreground">
                {t('appointments:formDialog.branchLabel')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)_400px] lg:overflow-hidden">

            {/* ── The client ─────────────────────────────────────────────── */}
            <div className="flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
              <div className="flex items-center justify-between">
                <Label>{t('appointments:formDialog.clientLabel')}</Label>
                {/* Shape only: creating a client happens in the clients
                    module, and there is no inline path to it. */}
                <Button type="button" variant="outline" size="xs" onClick={showsPlaceholderNotice}>
                  {t('appointments:formDialog.newClientButton')}
                </Button>
              </div>

              {/* Fixed while converting: a different client would be a
                  different person's place in the queue, not this one. */}
              {isConverting ? (
                <div className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium">
                  {clientName || ''}
                </div>
              ) : (
                <>
                  {/* The list is inline rather than behind a picker dialog,
                      the way the screen this follows is laid out — and a
                      dialog opening on top of a dialog to choose one name was
                      never worth the second surface. Two characters before it
                      searches, which is the hook's own floor. */}
                  <Input
                    placeholder={t('clientsList:searchPlaceholder')}
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <div className="flex h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClient(c); setClientSearch('') }}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                      >
                        <Avatar size="sm">
                          <AvatarFallback style={{ background: getAvatarColor(c.id), color: '#fff' }}>
                            {getInitials(c.first_name, c.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate">{c.first_name} {c.last_name}</span>
                      </button>
                    ))}
                    {clientSearch.trim().length >= 2 && clientResults.length === 0 && (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">{t('common:noResults')}</div>
                    )}
                    {clientSearch.trim().length < 2 && (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        {t('appointments:formDialog.searchClientHint')}
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-16 flex-col justify-center rounded-lg border border-border bg-muted/40 px-3 py-2">
                    {client ? (
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback style={{ background: getAvatarColor(client.id), color: '#fff' }}>
                            {getInitials(client.first_name, client.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{clientName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{client.phone_number}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t('appointments:formDialog.noClientChosenHint')}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={!client}
                      onClick={() => setClient(null)}
                    >
                      {t('appointments:formDialog.clearClientButton')}
                    </Button>
                    {/* Shape only: every appointment must name a real client —
                        client_id is required and the row is a historical
                        record, so there is no walk-in without one. */}
                    <Button type="button" variant="outline" onClick={showsPlaceholderNotice}>
                      {t('appointments:formDialog.guestButton')}
                    </Button>
                  </div>
                </>
              )}

              <div className="mt-2 flex flex-col gap-1.5">
                <Label>{t('appointments:formDialog.acquisitionSourceLabel')}</Label>
                {/* Shape only: acquisition_sources exists and belongs to the
                    client, not to one appointment, so nothing here is saved. */}
                <select
                  className={FIELD}
                  value=""
                  onChange={showsPlaceholderNotice}
                >
                  <option value="">{t('appointments:formDialog.selectPlaceholder')}</option>
                </select>
              </div>
            </div>

            {/* ── What is being booked ───────────────────────────────────── */}
            <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                {/* The day in words and the span beside it, the way the
                    reference heads this column. The range goes through
                    TimeRange rather than being pasted into the sentence:
                    two clock times either side of a dash are exactly the
                    thing that gets painted backwards here. */}
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>{dateLabel || t('appointments:formDialog.pickTimeHint')}</span>
                  {date && time && computedEndTime && (
                    <TimeRange start={`${date}T${time}:00`} end={computedEndTime} />
                  )}
                </span>
                {/* Shape only: moving a booking is its own dialog, reached
                    from the calendar once the booking exists. */}
                <Button type="button" variant="outline" size="sm" onClick={showsPlaceholderNotice}>
                  {t('appointments:formDialog.moveButton')}
                </Button>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                {/* Hidden on a waiting entry, and it has to be: that path
                    writes employee_id, start_time and end_time as null, so
                    leaving these on screen would be three fields quietly
                    thrown away on save. */}
                {!isWaiting && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={cn(FIELD, 'min-w-40 flex-1')} value={employeeId} onChange={(e) => handleEmployeeChange(e.target.value)}>
                      <option value="">{t('appointments:formDialog.employeeLabel')}</option>
                      {(employees || []).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    <Input type="time" className="w-28" value={time} onChange={(e) => setTime(e.target.value)} />
                    {/* cn, not a template string: FIELD carries w-full and the
                        later width would otherwise lose to it rather than
                        replace it. */}
                    <div className={cn(FIELD, 'flex w-24 items-center text-muted-foreground')}>
                      {selectedService
                        ? t('services:minutesShort', { count: selectedService.duration_minutes })
                        : '—'}
                    </div>
                    <Input type="date" className="w-36" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5">
                  <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {selectedService ? selectedService.name : t('appointments:formDialog.bookedTimeLabel')}
                  </span>
                  {selectedService && (
                    <button
                      type="button"
                      title={t('appointments:formDialog.removeServiceTitle')}
                      onClick={() => handleServiceChange('')}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Minus className="size-3" />
                    </button>
                  )}
                </div>

                {/* Extra professionals on the same session. Each one becomes
                    its own appointment row, so each one's time is protected
                    by the same constraint as the main professional's — a
                    four-hands massage genuinely occupies both of them. Gone
                    on a waiting entry for the same reason as the row above:
                    that path saves no professional at all. */}
                {!isWaiting && extraEmployeeIds.map((extraId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      className={`${FIELD} flex-1`}
                      value={extraId}
                      onChange={(e) => setExtraEmployeeIds((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                    >
                      <option value="">{t('appointments:formDialog.extraEmployeeLabel', { number: index + 2 })}</option>
                      {eligibleExtras
                        .filter((emp) => emp.id === extraId || !extraEmployeeIds.includes(emp.id))
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}{emp.is_assistant ? ` (${t('employees:formDialog.isAssistantLabel')})` : ''}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title={t('appointments:formDialog.removeExtraEmployeeTitle')}
                      onClick={() => setExtraEmployeeIds((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X />
                    </Button>
                  </div>
                ))}

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {/* Shape only: the note is stored as plain text, and these
                        buttons do not change that. */}
                    {FORMAT_BUTTONS.map(([key, Icon]) => (
                      <button
                        key={key}
                        type="button"
                        title={t(`appointments:formDialog.format.${key}`)}
                        onClick={showsPlaceholderNotice}
                        className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Icon className="size-3.5" />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    rows={2}
                    placeholder={t('appointments:formDialog.noteLabel')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Always on screen, disabled rather than absent. Who may join a
                  session depends on the service, so before one is chosen
                  there is no list to offer — but a control that vanishes
                  reads as a feature that is missing, and the title says which
                  of the two this is. */}
              {!isWaiting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={!canAddProfessional}
                  title={addProfessionalHint}
                  onClick={() => setExtraEmployeeIds((prev) => [...prev, ''])}
                >
                  <Plus />
                  {t('appointments:formDialog.addProfessionalButton')}
                </Button>
              )}

              {selectedEmployee && visibleServices.length === 0 && (
                <div className="text-sm text-muted-foreground">{t('appointments:formDialog.noServicesForRoleHint')}</div>
              )}

              {/* Meaningless while converting: this is the way out of the
                  waiting list, not into it. */}
              <label className={`flex items-center gap-2 text-sm font-medium ${isConverting ? 'hidden' : ''}`}>
                <input type="checkbox" className="accent-primary" checked={isWaiting} onChange={(e) => setIsWaiting(e.target.checked)} />
                {t('appointments:formDialog.waitingToggleLabel')}
              </label>

              {!isWaiting && computedEndTime && (
                <div className="text-sm text-muted-foreground">
                  {t('appointments:formDialog.endsAtText', { time: toTimeInputValue(computedEndTime) })}
                </div>
              )}

              {!isWaiting && remaining && (
                <div
                  className={
                    remaining.free === 0
                      ? 'rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive'
                      : 'rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'
                  }
                >
                  {remaining.free === 0
                    ? t('appointments:formDialog.allResourcesBusyError')
                    : t('appointments:formDialog.resourcesRemainingText', { free: remaining.free, total: remaining.total })}
                </div>
              )}

              <div className="mt-auto flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  {/* Shape only: colour belongs to the service in this
                      database, and a booking wears its service's. */}
                  <button
                    type="button"
                    onClick={showsPlaceholderNotice}
                    className="size-7 shrink-0 rounded-lg border border-border"
                    style={{ background: selectedService?.color || 'var(--color-muted)' }}
                    title={t('appointments:formDialog.appointmentColorLabel')}
                  />
                  <span className="text-sm text-muted-foreground">{t('appointments:formDialog.appointmentColorLabel')}</span>
                </div>

                {/* Who is filling this in, read from the session. Nothing is
                    stored: appointments carry created_at and no created_by. */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserRound className="size-3.5 text-emerald-600" />
                  <span>{currentUser || t('appointments:formDialog.currentUserFallback')}</span>
                  <span>{nowLabel}</span>
                </div>

                {/* Shape only: confirmed-versus-provisional is decided by the
                    shift check on save, not by a checkbox here. */}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="accent-primary" checked={false} onChange={showsPlaceholderNotice} />
                  {t('appointments:formDialog.confirmedLabel')}
                </label>

                {/* Shape only. */}
                <button
                  type="button"
                  onClick={showsPlaceholderNotice}
                  title={t('appointments:formDialog.greenActionTitle')}
                  className="flex h-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                >
                  <Clock className="size-4" />
                </button>

                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="text-muted-foreground">{t('appointments:formDialog.totalLabel')}</span>
                  <span className="font-medium">
                    {t('services:priceShort', { price: bookingTotal(selectedService).toLocaleString('ar') })}
                  </span>
                </div>
              </div>
            </div>

            {/* ── What there is to book ──────────────────────────────────── */}
            <div className="flex min-h-0 flex-col rounded-xl border border-border p-2 lg:overflow-hidden">
              <ServicePickerPanel
                categories={categories}
                services={visibleServices}
                selectedServiceId={serviceId}
                onPick={(s) => handleServiceChange(s.id)}
              />
            </div>
          </div>

          {outsideSchedule && (
            <div className="shrink-0 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {t('appointments:formDialog.outsideScheduleWarning', { name: outsideSchedule.names })}
            </div>
          )}

          {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

          {/* The warning replaces the footer rather than adding to it: with
              "save" still sitting there, the answer to "book provisionally?"
              would have two yes buttons.

              shrink-0: this is the row that went off the bottom of the screen
              behind a long category, and it is the row that must never move. */}
          <DialogFooter className="shrink-0">
            {outsideSchedule ? (
              <>
                <Button variant="outline" disabled={saving} onClick={() => setOutsideSchedule(null)}>
                  {t('appointments:formDialog.backButton')}
                </Button>
                <Button disabled={saving} onClick={() => handleSave(true)}>
                  {saving ? t('common:saving') : t('appointments:formDialog.bookProvisionallyButton')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
                <Button disabled={saving} onClick={() => handleSave(false)}>
                  {saving
                    ? t('common:saving')
                    : isConverting
                    ? t('appointments:formDialog.convertButton')
                    : t('common:save')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One notice for every shape on this screen that has nothing behind it
          yet, in the same words the rest of the app uses for the same
          promise. Better than a dead control: a press that does nothing reads
          as a bug, and this reads as a plan. */}
      <Dialog open={placeholderNotice} onOpenChange={setPlaceholderNotice}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('appointments:formDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {t('common:sectionInDevelopmentNotice', { label: t('appointments:formDialog.placeholderLabel') })}
          </div>
          <DialogFooter>
            <Button onClick={() => setPlaceholderNotice(false)}>{t('common:close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
