import { useTranslation } from 'next-i18next'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SCHEDULE_PATTERNS } from '../lib/employeeSchedule'

const WEEKLY_DAY_ORDER = ['0', '1', '2', '3', '4', '5', '6']

function SlotRow({ label, slot, onChange, error, t, hideActiveToggle }) {
  if (!slot) return null
  return (
    <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[140px_1fr_1fr_1fr]">
      <label className="flex items-center gap-2 text-sm font-medium">
        {!hideActiveToggle && (
          <input
            type="checkbox"
            className="accent-primary"
            checked={slot.isActive}
            onChange={(e) => onChange('isActive', e.target.checked)}
          />
        )}
        {label}
      </label>
      <div className="flex flex-col gap-1.5">
        <Label>{t('settings:workingHours.fromLabel')}</Label>
        <Input type="time" value={slot.startTime} disabled={!slot.isActive} onChange={(e) => onChange('startTime', e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('settings:workingHours.toLabel')}</Label>
        <Input type="time" value={slot.endTime} disabled={!slot.isActive} onChange={(e) => onChange('endTime', e.target.value)} />
      </div>
      <div className="text-sm text-destructive">{error ? t('settings:workingHours.closeBeforeOpenError') : ''}</div>
    </div>
  )
}

export default function EmployeeScheduleFields({
  pattern,
  onPatternChange,
  slots,
  onSlotChange,
  workDaysCount,
  cycleLengthDays,
  onCycleFieldChange,
  startsOn,
  onStartsOnChange,
  slotErrors,
  cycleError,
}) {
  const { t } = useTranslation(['employees', 'settings', 'common'])
  const slotByKey = Object.fromEntries(slots.map((s) => [s.slotKey, s]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>{t('employees:scheduleFields.patternLabel')}</Label>
        <select
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          value={pattern}
          onChange={(e) => onPatternChange(e.target.value)}
        >
          {SCHEDULE_PATTERNS.map((p) => (
            <option key={p} value={p}>{t(`employees:scheduleFields.patterns.${p}`)}</option>
          ))}
        </select>
      </div>

      {(pattern === 'even_odd' || pattern === 'cycle') && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('employees:scheduleFields.startsOnLabel')}</Label>
          <Input type="date" value={startsOn || ''} onChange={(e) => onStartsOnChange(e.target.value)} />
        </div>
      )}

      {pattern === 'cycle' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('employees:scheduleFields.workDaysLabel')}</Label>
            <Input type="number" min="1" value={workDaysCount} onChange={(e) => onCycleFieldChange('workDaysCount', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('employees:scheduleFields.cycleLengthLabel')}</Label>
            <Input type="number" min="1" value={cycleLengthDays} onChange={(e) => onCycleFieldChange('cycleLengthDays', e.target.value)} />
          </div>
        </div>
      )}
      {cycleError && <div className="text-sm text-destructive">{t(`employees:scheduleFields.cycleErrors.${cycleError}`)}</div>}

      <div className="flex flex-col gap-2">
        {pattern === 'weekly' && WEEKLY_DAY_ORDER.map((day) => (
          <SlotRow
            key={day}
            label={t(`settings:workingHours.days.${day}`)}
            slot={slotByKey[day]}
            onChange={(field, value) => onSlotChange(day, field, value)}
            error={slotErrors[day]}
            t={t}
          />
        ))}
        {pattern === 'even_odd' && ['even', 'odd'].map((key) => (
          <SlotRow
            key={key}
            label={t(`employees:scheduleFields.evenOdd.${key}`)}
            slot={slotByKey[key]}
            onChange={(field, value) => onSlotChange(key, field, value)}
            error={slotErrors[key]}
            t={t}
          />
        ))}
        {pattern === 'cycle' && (
          <SlotRow
            label={t('employees:scheduleFields.workingHoursLabel')}
            slot={slotByKey.work}
            onChange={(field, value) => onSlotChange('work', field, value)}
            error={slotErrors.work}
            t={t}
            hideActiveToggle
          />
        )}
      </div>
    </div>
  )
}
