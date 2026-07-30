import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { UserPlus } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import EmployeeFormDialog from './EmployeeFormDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function EmployeesApp({ salonId }) {
  const { t } = useTranslation(['employees', 'common'])
  const { employees, loading, reload } = useEmployees()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)

  function openAdd() {
    setEditingEmployee(null)
    setDialogOpen(true)
  }

  function openEdit(employee) {
    setEditingEmployee(employee)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('employees:listTitle')}</h2>
        <Button onClick={openAdd}>
          <UserPlus />
          {t('employees:addEmployeeButton')}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
      ) : employees.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t('employees:emptyList')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => (
            <Card key={emp.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openEdit(emp)}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="truncate font-medium text-foreground">{emp.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="w-fit">{t(`employees:roles.${emp.role}`)}</Badge>
                  {emp.is_assistant && (
                    <Badge variant="outline" className="w-fit">{t('employees:formDialog.isAssistantLabel')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmployee}
        salonId={salonId}
        onSaved={reload}
      />
    </div>
  )
}
