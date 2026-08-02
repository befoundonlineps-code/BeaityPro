import { useTranslation } from 'next-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import TimeRange from './TimeRange'

export default function ResourceBookingsDialog({ open, onOpenChange, resource, cluster, unitsById, employeesById, clientsById, servicesById }) {
  const { t } = useTranslation(['appointments', 'common'])

  const rows = cluster
    ? [...cluster.items].sort((a, b) => {
        const ua = unitsById[a.resource_unit_id]?.unit_index ?? 0
        const ub = unitsById[b.resource_unit_id]?.unit_index ?? 0
        if (ua !== ub) return ua - ub
        return new Date(a.start_time) - new Date(b.start_time)
      })
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('appointments:resourceDialog.title', { name: resource ? resource.name : '' })}
          </DialogTitle>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('appointments:resourceDialog.unitColumn')}</TableHead>
              <TableHead>{t('appointments:resourceDialog.timeColumn')}</TableHead>
              <TableHead>{t('appointments:resourceDialog.employeeColumn')}</TableHead>
              <TableHead>{t('appointments:resourceDialog.clientColumn')}</TableHead>
              <TableHead>{t('appointments:resourceDialog.serviceColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => {
              const unit = unitsById[a.resource_unit_id]
              const employee = employeesById[a.employee_id]
              const client = clientsById[a.client_id]
              const service = servicesById[a.service_id]
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {t('appointments:resourceDialog.unitLabel', { index: unit ? unit.unit_index : '—' })}
                  </TableCell>
                  <TableCell><TimeRange start={a.start_time} end={a.end_time} /></TableCell>
                  <TableCell>{employee ? employee.name : '—'}</TableCell>
                  <TableCell>{client ? `${client.first_name} ${client.last_name || ''}`.trim() : '—'}</TableCell>
                  <TableCell>
                    <span
                      className="me-1.5 inline-block size-2 rounded-full align-middle"
                      style={{ background: service?.color || 'var(--color-muted-foreground)' }}
                    />
                    {service ? service.name : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
