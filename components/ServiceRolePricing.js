import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import { useServiceRolePrices } from '../hooks/useServiceRolePrices'
import { EMPLOYEE_ROLES } from '../lib/employeeRoles'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function cellKey(serviceId, role) {
  return `${serviceId}:${role}`
}

export default function ServiceRolePricing() {
  const { t } = useTranslation(['employees', 'common'])
  const { services, loading: catalogLoading } = useServiceCatalog()
  const { prices, loading: pricesLoading, reload } = useServiceRolePrices()

  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const loading = catalogLoading || pricesLoading

  useEffect(() => {
    if (loading) return
    const initial = {}
    for (const p of prices) initial[cellKey(p.service_id, p.role)] = String(p.price)
    setEdits(initial)
  }, [prices, loading])

  function handleCellChange(serviceId, role, value) {
    setEdits((prev) => ({ ...prev, [cellKey(serviceId, role)]: value }))
    setSaved(false)
  }

  const originalByKey = Object.fromEntries(prices.map((p) => [cellKey(p.service_id, p.role), p]))

  async function handleSave() {
    setError('')
    setSaved(false)
    setSaving(true)

    const rowsToUpsert = []
    const idsToDelete = []

    for (const service of services) {
      for (const role of EMPLOYEE_ROLES) {
        const key = cellKey(service.id, role)
        const original = originalByKey[key]
        const edited = (edits[key] ?? '').trim()

        if (edited === '') {
          if (original) idsToDelete.push(original.id)
          continue
        }
        const numeric = Number(edited)
        if (Number.isNaN(numeric) || numeric < 0) continue
        if (!original || Number(original.price) !== numeric) {
          rowsToUpsert.push({ salon_id: service.salon_id, service_id: service.id, role, price: numeric })
        }
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('service_role_prices')
        .upsert(rowsToUpsert, { onConflict: 'service_id,role' })
      if (upsertError) {
        setSaving(false)
        setError(upsertError.message)
        return
      }
    }

    if (idsToDelete.length > 0) {
      const { data, error: deleteError } = await supabase
        .from('service_role_prices')
        .delete()
        .in('id', idsToDelete)
        .select()
      if (deleteError) {
        setSaving(false)
        setError(deleteError.message)
        return
      }
      if (!data || data.length !== idsToDelete.length) {
        setSaving(false)
        setError(t('employees:pricing.noRowsError'))
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('employees:pricing.hint')}</p>
      {error && <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>}
      {saved && (
        <div className="rounded-lg bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          {t('employees:pricing.saveSuccessMessage')}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 z-10 bg-card">{t('employees:pricing.serviceColumn')}</TableHead>
                {EMPLOYEE_ROLES.map((role) => (
                  <TableHead key={role}>{t(`employees:roles.${role}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="sticky start-0 z-10 bg-card font-medium">
                    {service.name}
                    <div className="text-xs text-muted-foreground">
                      {t('employees:pricing.basePriceHint', { price: Number(service.price).toLocaleString('ar') })}
                    </div>
                  </TableCell>
                  {EMPLOYEE_ROLES.map((role) => {
                    const key = cellKey(service.id, role)
                    const value = edits[key] ?? ''
                    return (
                      <TableCell key={role}>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24"
                          placeholder={String(service.price)}
                          value={value}
                          onChange={(e) => handleCellChange(service.id, role, e.target.value)}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? t('common:saving') : t('employees:pricing.saveButton')}
        </Button>
      </div>
    </div>
  )
}
