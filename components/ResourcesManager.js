import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus } from 'lucide-react'
import { useResources } from '../hooks/useResources'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import ResourceFormDialog from './ResourceFormDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ResourcesManager({ salonId }) {
  const { t } = useTranslation(['services', 'common'])
  const { resources, serviceResources, loading, reload } = useResources()
  const { services, loading: servicesLoading } = useServiceCatalog()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function linkedCount(resourceId) {
    return (serviceResources || []).filter((sr) => sr.resource_id === resourceId).length
  }

  if (loading || servicesLoading) {
    return <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('services:resources.hint')}</p>
        <Button onClick={openAdd}>
          <Plus />
          {t('services:resources.addButton')}
        </Button>
      </div>

      {resources.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t('services:resources.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer transition-shadow hover:shadow-xs"
              onClick={() => { setEditing(r); setDialogOpen(true) }}
            >
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="truncate font-medium text-foreground">{r.name}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{t('services:resources.capacityBadge', { count: r.capacity })}</Badge>
                  <Badge variant="outline">{t('services:resources.linkedBadge', { count: linkedCount(r.id) })}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResourceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        resource={editing}
        salonId={salonId}
        services={services}
        serviceResources={serviceResources}
        onSaved={reload}
      />
    </div>
  )
}
