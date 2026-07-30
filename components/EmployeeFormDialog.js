import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { EMPLOYEE_ROLES } from '../lib/employeeRoles'
import { defaultSlotsForPattern, slotsFromRows, validateSlots, validateCycleFields } from '../lib/employeeSchedule'
import EmployeeScheduleFields from './EmployeeScheduleFields'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function EmployeeFormDialog({ open, onOpenChange, employee, salonId, onSaved }) {
  const { t } = useTranslation(['employees', 'common'])
  const isEdit = !!employee

  const [name, setName] = useState('')
  const [role, setRole] = useState(EMPLOYEE_ROLES[0])
  const [isAssistant, setIsAssistant] = useState(false)
  const [scheduleId, setScheduleId] = useState(null)
  const [pattern, setPattern] = useState('weekly')
  const [startsOn, setStartsOn] = useState('')
  const [workDaysCount, setWorkDaysCount] = useState('2')
  const [cycleLengthDays, setCycleLengthDays] = useState('4')
  const [slots, setSlots] = useState(defaultSlotsForPattern('weekly'))
  const [saving, setSaving] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setError('')
      setName(employee ? employee.name : '')
      setRole(employee ? employee.role : EMPLOYEE_ROLES[0])
      setIsAssistant(employee ? !!employee.is_assistant : false)

      if (!employee) {
        setScheduleId(null)
        setPattern('weekly')
        setStartsOn(today())
        setWorkDaysCount('2')
        setCycleLengthDays('4')
        setSlots(defaultSlotsForPattern('weekly'))
        return
      }

      setLoadingSchedule(true)
      const { data: scheduleRow } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', employee.id)
        .maybeSingle()

      if (cancelled) return

      if (!scheduleRow) {
        setScheduleId(null)
        setPattern('weekly')
        setStartsOn(today())
        setWorkDaysCount('2')
        setCycleLengthDays('4')
        setSlots(defaultSlotsForPattern('weekly'))
        setLoadingSchedule(false)
        return
      }

      const { data: slotRows } = await supabase
        .from('employee_schedule_slots')
        .select('*')
        .eq('schedule_id', scheduleRow.id)

      if (cancelled) return

      setScheduleId(scheduleRow.id)
      setPattern(scheduleRow.pattern_type)
      setStartsOn(scheduleRow.starts_on || today())
      setWorkDaysCount(scheduleRow.work_days_count != null ? String(scheduleRow.work_days_count) : '2')
      setCycleLengthDays(scheduleRow.cycle_length_days != null ? String(scheduleRow.cycle_length_days) : '4')
      setSlots(slotsFromRows(scheduleRow.pattern_type, slotRows || []))
      setLoadingSchedule(false)
    }

    load()
    return () => { cancelled = true }
  }, [open, employee])

  function handlePatternChange(nextPattern) {
    setPattern(nextPattern)
    setSlots(defaultSlotsForPattern(nextPattern))
    if (!startsOn) setStartsOn(today())
  }

  function handleSlotChange(slotKey, field, value) {
    setSlots((prev) => prev.map((s) => (s.slotKey === slotKey ? { ...s, [field]: value } : s)))
  }

  function handleCycleFieldChange(field, value) {
    if (field === 'workDaysCount') setWorkDaysCount(value)
    else setCycleLengthDays(value)
  }

  const slotErrors = validateSlots(slots)
  const cycleError = pattern === 'cycle' ? validateCycleFields(workDaysCount, cycleLengthDays) : null
  const startsOnMissing = (pattern === 'even_odd' || pattern === 'cycle') && !startsOn
  const hasBlockingError = Object.keys(slotErrors).length > 0 || !!cycleError || startsOnMissing

  async function handleSave() {
    if (!name.trim()) {
      setError(t('employees:formDialog.nameRequiredError'))
      return
    }
    if (hasBlockingError) {
      setError(t('employees:formDialog.fixErrorsFirst'))
      return
    }

    setError('')
    setSaving(true)

    const employeePayload = { name: name.trim(), role, is_assistant: isAssistant }
    const { data: employeeData, error: employeeError } = isEdit
      ? await supabase.from('employees').update(employeePayload).eq('id', employee.id).select()
      : await supabase.from('employees').insert([{ ...employeePayload, salon_id: salonId }]).select()

    if (employeeError) {
      setSaving(false)
      setError(employeeError.message)
      return
    }
    if (!employeeData || employeeData.length === 0) {
      setSaving(false)
      setError(t('employees:formDialog.noRowsError'))
      return
    }
    const employeeId = isEdit ? employee.id : employeeData[0].id

    const schedulePayload = {
      pattern_type: pattern,
      starts_on: pattern === 'weekly' ? null : startsOn,
      work_days_count: pattern === 'cycle' ? Number(workDaysCount) : null,
      cycle_length_days: pattern === 'cycle' ? Number(cycleLengthDays) : null,
    }

    let finalScheduleId = scheduleId
    if (scheduleId) {
      const { data, error: scheduleError } = await supabase
        .from('employee_schedules')
        .update(schedulePayload)
        .eq('id', scheduleId)
        .select()
      if (scheduleError) {
        setSaving(false)
        setError(scheduleError.message)
        return
      }
      if (!data || data.length === 0) {
        setSaving(false)
        setError(t('employees:formDialog.noRowsError'))
        return
      }
    } else {
      const { data, error: scheduleError } = await supabase
        .from('employee_schedules')
        .insert([{ ...schedulePayload, employee_id: employeeId, salon_id: salonId }])
        .select()
      if (scheduleError) {
        setSaving(false)
        setError(scheduleError.message)
        return
      }
      if (!data || data.length === 0) {
        setSaving(false)
        setError(t('employees:formDialog.noRowsError'))
        return
      }
      finalScheduleId = data[0].id
    }

    if (scheduleId) {
      const { error: deleteError } = await supabase.from('employee_schedule_slots').delete().eq('schedule_id', finalScheduleId)
      if (deleteError) {
        setSaving(false)
        setError(deleteError.message)
        return
      }
    }

    const slotRows = slots.map((s) => ({
      salon_id: salonId,
      schedule_id: finalScheduleId,
      slot_key: s.slotKey,
      is_active: s.isActive,
      start_time: s.startTime,
      end_time: s.endTime,
    }))
    const { data: slotData, error: slotError } = await supabase.from('employee_schedule_slots').insert(slotRows).select()

    setSaving(false)

    if (slotError) {
      setError(slotError.message)
      return
    }
    if (!slotData || slotData.length !== slotRows.length) {
      setError(t('employees:formDialog.noRowsError'))
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('employees:formDialog.editTitle') : t('employees:formDialog.addTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t('employees:formDialog.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('employees:formDialog.roleLabel')}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {EMPLOYEE_ROLES.map((r) => (
                  <option key={r} value={r}>{t(`employees:roles.${r}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="accent-primary" checked={isAssistant} onChange={(e) => setIsAssistant(e.target.checked)} />
            {t('employees:formDialog.isAssistantLabel')}
          </label>
          <p className="-mt-2 text-xs text-muted-foreground">{t('employees:formDialog.isAssistantHint')}</p>

          {loadingSchedule ? (
            <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
          ) : (
            <EmployeeScheduleFields
              pattern={pattern}
              onPatternChange={handlePatternChange}
              slots={slots}
              onSlotChange={handleSlotChange}
              workDaysCount={workDaysCount}
              cycleLengthDays={cycleLengthDays}
              onCycleFieldChange={handleCycleFieldChange}
              startsOn={startsOn}
              onStartsOnChange={setStartsOn}
              slotErrors={slotErrors}
              cycleError={cycleError}
            />
          )}
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving || loadingSchedule || hasBlockingError} onClick={handleSave}>
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
