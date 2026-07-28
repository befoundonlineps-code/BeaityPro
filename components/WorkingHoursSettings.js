import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { useBusinessHours } from '../hooks/useBusinessHours'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// الأحد إلى السبت — ترتيب العرض المحلي، مستقل عمدًا عن ترتيب التخزين بقاعدة البيانات (day_of_week 0-6)
const DISPLAY_ORDER = [0, 1, 2, 3, 4, 5, 6]

export default function WorkingHoursSettings() {
  const { t } = useTranslation(['settings', 'common'])
  const { hours, loading, reload } = useBusinessHours()
  const [rows, setRows] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (loading) return
    const byDay = {}
    for (const h of hours) {
      byDay[h.day_of_week] = {
        id: h.id,
        isOpen: h.is_open,
        openTime: h.open_time.slice(0, 5),
        closeTime: h.close_time.slice(0, 5),
      }
    }
    setRows(byDay)
  }, [hours, loading])

  function update(day, field, value) {
    setRows((r) => ({ ...r, [day]: { ...r[day], [field]: value } }))
    setSaved(false)
  }

  const errors = {}
  for (const day of DISPLAY_ORDER) {
    const row = rows[day]
    if (row?.isOpen && row.closeTime <= row.openTime) {
      errors[day] = t('settings:workingHours.closeBeforeOpenError')
    }
  }
  const hasErrors = Object.keys(errors).length > 0

  async function handleSave() {
    if (hasErrors) return
    setError('')
    setSaved(false)
    setSaving(true)
    for (const day of DISPLAY_ORDER) {
      const row = rows[day]
      if (!row) continue
      const { error } = await supabase
        .from('business_hours')
        .update({ is_open: row.isOpen, open_time: row.openTime, close_time: row.closeTime })
        .eq('id', row.id)
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
    }
    setSaving(false)
    setSaved(true)
    reload()
    setTimeout(() => setSaved(false), 4000)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings:workingHours.cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>}
        {saved && (
          <div className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
            {t('settings:workingHours.saveSuccessMessage')}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {DISPLAY_ORDER.map((day) => {
            const row = rows[day]
            if (!row) return null
            return (
              <div
                key={day}
                className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[140px_1fr_1fr_1fr]"
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={row.isOpen}
                    onChange={(e) => update(day, 'isOpen', e.target.checked)}
                  />
                  {t(`settings:workingHours.days.${day}`)}
                </label>
                <div className="flex flex-col gap-1.5">
                  <Label>{t('settings:workingHours.fromLabel')}</Label>
                  <Input
                    type="time"
                    value={row.openTime}
                    disabled={!row.isOpen}
                    onChange={(e) => update(day, 'openTime', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t('settings:workingHours.toLabel')}</Label>
                  <Input
                    type="time"
                    value={row.closeTime}
                    disabled={!row.isOpen}
                    onChange={(e) => update(day, 'closeTime', e.target.value)}
                  />
                </div>
                <div className="text-sm text-destructive">{errors[day]}</div>
              </div>
            )
          })}
        </div>

        <div>
          <Button disabled={saving || hasErrors} onClick={handleSave}>
            {saving ? t('common:saving') : t('settings:workingHours.saveButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
