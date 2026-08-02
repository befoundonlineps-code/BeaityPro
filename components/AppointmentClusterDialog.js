import { useTranslation } from 'next-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

function timeLabel(value) {
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Unlike the resource column's cluster dialog, these rows stay actionable:
// picking one closes this list and opens AppointmentActionsDialog for that
// single appointment, the same dialog a non-overlapping block opens
// directly. This dialog only exists to resolve which one you meant.
export default function AppointmentClusterDialog({ open, onOpenChange, employee, cluster, onPick, clientsById, servicesById }) {
  const { t } = useTranslation(['appointments', 'common'])

  const rows = cluster
    ? [...cluster.items].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('appointments:employeeCluster.dialogTitle', { name: employee ? employee.name : '' })}
          </DialogTitle>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('appointments:employeeCluster.timeColumn')}</TableHead>
              <TableHead>{t('appointments:employeeCluster.clientColumn')}</TableHead>
              <TableHead>{t('appointments:employeeCluster.serviceColumn')}</TableHead>
              <TableHead>{t('appointments:employeeCluster.statusColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => {
              const client = clientsById[a.client_id]
              const service = servicesById[a.service_id]
              return (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => onPick(a)}
                >
                  {/* One isolate around the whole range, not one per end:
                      the dash between them is the neutral that gets swapped.
                      See the note on ranges in CLAUDE.md. */}
                  <TableCell><span dir="ltr">{timeLabel(a.start_time)} — {timeLabel(a.end_time)}</span></TableCell>
                  <TableCell>{client ? `${client.first_name} ${client.last_name || ''}`.trim() : '—'}</TableCell>
                  <TableCell>
                    <span
                      className="me-1.5 inline-block size-2 rounded-full align-middle"
                      style={{ background: service?.color || 'var(--color-muted-foreground)' }}
                    />
                    {service ? service.name : '—'}
                  </TableCell>
                  <TableCell>{t(`appointments:statusLabels.${a.status}`)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
