import { useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { ChevronDown, ChevronLeft, Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { buildServiceTree, countServices } from '../lib/serviceTree'
import { useBusinessTypes } from '../hooks/useBusinessTypes'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import ServiceFormDialog from './ServiceFormDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function ServiceRow({ service, t, onToggleActive, onEdit }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ background: service.color || 'var(--color-muted-foreground)' }}
      />
      <span className={`min-w-0 flex-1 truncate text-sm ${service.is_active ? '' : 'text-muted-foreground line-through'}`}>
        {service.name}
      </span>
      {!service.is_active && <Badge variant="outline">{t('services:inactiveBadge')}</Badge>}
      <span className="shrink-0 text-xs text-muted-foreground">
        {t('services:minutesShort', { count: service.duration_minutes })}
      </span>
      <span className="shrink-0 text-sm font-medium">
        {t('services:priceShort', { price: Number(service.price).toLocaleString('ar') })}
      </span>
      <label className="flex shrink-0 cursor-pointer items-center" title={t('services:activeToggleTitle')}>
        <input
          type="checkbox"
          className="accent-primary"
          checked={service.is_active}
          onChange={(e) => onToggleActive(service, e.target.checked)}
        />
      </label>
      <Button variant="outline" size="icon-sm" title={t('services:editServiceTitle')} onClick={() => onEdit(service)}>
        <Pencil />
      </Button>
    </div>
  )
}

export default function ServicesTree({ salonId }) {
  const { t } = useTranslation(['services', 'settings', 'common'])
  const router = useRouter()
  const { types, loading: typesLoading } = useBusinessTypes()
  const { categories, services, loading: catalogLoading, reload } = useServiceCatalog()

  const [collapsedRoots, setCollapsedRoots] = useState({})
  const [openSubs, setOpenSubs] = useState({})
  const [dialog, setDialog] = useState(null) // { service, categoryId }
  const [error, setError] = useState('')

  const loading = typesLoading || catalogLoading
  const tree = buildServiceTree(categories, services, types)

  async function toggleActive(service, isActive) {
    setError('')
    const { data, error: toggleError } = await supabase
      .from('services')
      .update({ is_active: isActive })
      .eq('id', service.id)
      .select()

    if (toggleError) {
      setError(toggleError.message)
      return
    }
    if (!data || data.length === 0) {
      setError(t('services:toggleFailedMessage'))
      return
    }
    reload()
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  if (types.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="font-medium">{t('services:noBusinessTypesTitle')}</div>
          <p className="text-sm text-muted-foreground">{t('services:noBusinessTypesMessage')}</p>
          <Button onClick={() => router.push('/settings?tab=businessTypes')}>
            {t('services:goToSettingsButton')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>}

      {tree.map((root) => {
        const rootOpen = !collapsedRoots[root.id]
        return (
          <Card key={root.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <button
                type="button"
                className="flex items-center gap-2 text-start"
                onClick={() => setCollapsedRoots((prev) => ({ ...prev, [root.id]: rootOpen }))}
              >
                {rootOpen ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
                <span className="size-3 shrink-0 rounded-full" style={{ background: root.services[0]?.color || root.children[0]?.services[0]?.color }} />
                <span className="font-semibold">{root.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t('services:servicesCount', { count: countServices(root) })}
                </span>
              </button>

              {rootOpen && (
                <div className="flex flex-col gap-2 ps-6">
                  {root.services.map((service) => (
                    <ServiceRow key={service.id} service={service} t={t} onToggleActive={toggleActive} onEdit={(s) => setDialog({ service: s, categoryId: root.id })} />
                  ))}

                  {root.children.map((sub) => {
                    const subOpen = !!openSubs[sub.id]
                    return (
                      <div key={sub.id} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 text-start"
                            onClick={() => setOpenSubs((prev) => ({ ...prev, [sub.id]: !subOpen }))}
                          >
                            {subOpen ? <ChevronDown className="size-4" /> : <ChevronLeft className="size-4" />}
                            <span className="text-sm font-medium">{sub.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('services:servicesCount', { count: sub.services.length })}
                            </span>
                          </button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDialog({ service: null, categoryId: sub.id })}
                          >
                            <Plus />
                            {t('services:addServiceButton')}
                          </Button>
                        </div>

                        {subOpen && (
                          <div className="flex flex-col gap-2 ps-6">
                            {sub.services.length === 0 ? (
                              <div className="text-sm text-muted-foreground">{t('services:emptyCategory')}</div>
                            ) : (
                              sub.services.map((service) => (
                                <ServiceRow
                                  key={service.id}
                                  service={service}
                                  t={t}
                                  onToggleActive={toggleActive}
                                  onEdit={(s) => setDialog({ service: s, categoryId: sub.id })}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      <ServiceFormDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        service={dialog?.service}
        categoryId={dialog?.categoryId}
        salonId={salonId}
        onSaved={reload}
      />
    </div>
  )
}
