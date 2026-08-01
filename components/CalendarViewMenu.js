import { useTranslation } from 'next-i18next'
import { ChevronDown, Users, UserCheck, Package } from 'lucide-react'
import {
  rolesInUse,
  VIEW_ALL,
  VIEW_ON_SHIFT,
  VIEW_ROLE,
  VIEW_EMPLOYEE,
  VIEW_RESOURCE,
} from '../lib/calendarView'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

// Picking what the calendar shows: the whole roster, only those working
// today, one role, or one professional or resource on their own.
//
// The trigger reports the current selection rather than carrying a fixed
// label. Once the board can be filtered, "which slice am I looking at?"
// becomes a question somebody can get wrong, and the answer belongs on the
// control that changed it.
export default function CalendarViewMenu({ selection, employees, resources, onSelect }) {
  const { t } = useTranslation(['appointments', 'employees'])

  const roleLabel = (role) => t(`employees:roles.${role}`)
  const roles = rolesInUse(employees, roleLabel)

  const employeesInRole = (role) =>
    (employees || []).filter((e) => e.role === role)

  function currentLabel() {
    switch (selection?.kind) {
      case VIEW_ON_SHIFT:
        return t('appointments:viewMenu.onShift')
      case VIEW_ROLE:
        return roleLabel(selection.role)
      case VIEW_EMPLOYEE:
        return (employees || []).find((e) => e.id === selection.employeeId)?.name || ''
      case VIEW_RESOURCE:
        return (resources || []).find((r) => r.id === selection.resourceId)?.name || ''
      default:
        return t('appointments:viewMenu.allProfessionals')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" title={t('appointments:viewMenu.title')}>
            <Users />
            <span className="max-w-40 truncate">{currentLabel()}</span>
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuItem onClick={() => onSelect({ kind: VIEW_ON_SHIFT })}>
          <UserCheck />
          {t('appointments:viewMenu.onShift')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect({ kind: VIEW_ALL })}>
          <Users />
          {t('appointments:viewMenu.allProfessionals')}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* One category per role somebody actually holds. Each opens onto its
            own "everyone in this category" plus the people in it by name — a
            role narrows the day, a name opens that person's week. */}
        {roles.map((role) => (
          <DropdownMenuSub key={role}>
            <DropdownMenuSubTrigger>{roleLabel(role)}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onSelect({ kind: VIEW_ROLE, role })}>
                {t('appointments:viewMenu.allInCategory')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {employeesInRole(role).map((emp) => (
                <DropdownMenuItem
                  key={emp.id}
                  onClick={() => onSelect({ kind: VIEW_EMPLOYEE, employeeId: emp.id })}
                >
                  {emp.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}

        {/* Resources sit on their own at the end rather than inside a role:
            they are not people, and nothing in the roles above describes
            them. Named by resource — the units inside are an allocation
            detail nobody books against by hand. */}
        {(resources || []).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Package />
                {t('appointments:viewMenu.resourceSchedule')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {resources.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    onClick={() => onSelect({ kind: VIEW_RESOURCE, resourceId: r.id })}
                  >
                    {r.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
