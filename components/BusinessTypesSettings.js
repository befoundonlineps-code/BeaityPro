import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { BUSINESS_TYPES } from '../lib/serviceTree'
import { useBusinessTypes } from '../hooks/useBusinessTypes'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function BusinessTypesSettings({ salonId }) {
  const { t } = useTranslation(['settings', 'common'])
  const { types, loading, reload } = useBusinessTypes()
  const [selected, setSelected] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loading) setSelected(types)
  }, [types, loading])

  function toggle(type) {
    setSaved(false)
    setSelected((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]))
  }

  async function handleSave() {
    setError('')
    setSaved(false)
    setSaving(true)

    // Only touch what actually changed, so a failure can never wipe the
    // existing selection the way a delete-everything-then-insert would.
    const toRemove = types.filter((x) => !selected.includes(x))
    const toAdd = selected.filter((x) => !types.includes(x))

    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('salon_business_types')
        .delete()
        .eq('salon_id', salonId)
        .in('business_type', toRemove)
      if (removeError) {
        setSaving(false)
        setError(removeError.message)
        return
      }
    }

    if (toAdd.length > 0) {
      const { error: addError } = await supabase
        .from('salon_business_types')
        .insert(toAdd.map((type) => ({ salon_id: salonId, business_type: type })))
      if (addError) {
        setSaving(false)
        setError(addError.message)
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
        <CardTitle>{t('settings:businessTypes.cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('settings:businessTypes.hint')}</p>

        {error && <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>}
        {saved && (
          <div className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
            {t('settings:businessTypes.saveSuccessMessage')}
          </div>
        )}
        {selected.length === 0 && (
          <div className="rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            {t('settings:businessTypes.noneSelectedWarning')}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_TYPES.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={selected.includes(type)}
                onChange={() => toggle(type)}
              />
              {t(`settings:businessTypes.types.${type}`)}
            </label>
          ))}
        </div>

        <div>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? t('common:saving') : t('settings:businessTypes.saveButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
