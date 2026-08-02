import { useTranslation } from 'next-i18next'
import { ChevronDown, Users, UserCheck, Package } from 'lucide-react'
import {
  rolesInUse,
  VIEW_ALL,
  VIEW_ON_SHIFT,
  VIEW_ROLE,
  VIEW_EMPLOYEE,
  VIEW_RESOURCE,
  VIEW_ALL_RESOURCES,
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
import { toolbarCardButton, ToolbarCount } from './ToolbarCard'

// A folder in the menu: "all of these" on top, then each member by name.
//
// Roles and resources are the same shape of question — narrow to a group, or
// go to one of its members — so they are the same component rather than two
// that have to be kept looking alike by hand.
function CategorySubmenu({ icon, label, allLabel, onSelectAll, members }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {icon}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={onSelectAll}>{allLabel}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {members.map((m) => (
          <DropdownMenuItem key={m.id} onClick={m.onSelect}>
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

// Picking what the calendar shows: the whole roster, only those working
// today, one role, or one professional or resource on their own.
//
// The trigger reports the current selection rather than carrying a fixed
// label. Once the board can be filtered, "which slice am I looking at?"
// becomes a question somebody can get wrong, and the answer belongs on the
// control that changed it.
export default function CalendarViewMenu({ selection, employees, resources, count, onSelect }) {
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
      case VIEW_ALL_RESOURCES:
        return t('appointments:viewMenu.allResources')
      default:
        return t('appointments:viewMenu.allProfessionals')
    }
  }

  return (
    <DropdownMenu>
      {/* A plain button rather than the shared one: it wears the toolbar's
          card instead of a button variant, and an intrinsic element takes the
          menu's ref without needing forwardRef in between. */}
      <DropdownMenuTrigger
        render={
          <button type="button" className={toolbarCardButton} title={t('appointments:viewMenu.title')}>
            <Users className="size-[18px] shrink-0 text-muted-foreground" />
            <span className="max-w-40 truncate text-[13px] font-medium">{currentLabel()}</span>
            {/* How many columns the current choice actually put on the board.
                On the default "on shift" that is the day's roster, which is
                what the number is for; in every other mode it still answers
                the same question rather than going stale. */}
            {typeof count === 'number' && <ToolbarCount>{count}</ToolbarCount>}
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
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

        {/* One category per role somebody actually holds, and one for the
            resources — every folder has the same two levels: "all of these"
            on top, then each member by name. Resources sit at the end rather
            than inside a role because nothing in the roles above describes a
            room, and they are named by resource: the units inside are an
            allocation detail nobody books against by hand. */}
        {roles.map((role) => (
          <CategorySubmenu
            key={role}
            label={roleLabel(role)}
            allLabel={t('appointments:viewMenu.allInCategory')}
            onSelectAll={() => onSelect({ kind: VIEW_ROLE, role })}
            members={employeesInRole(role).map((emp) => ({
              id: emp.id,
              name: emp.name,
              onSelect: () => onSelect({ kind: VIEW_EMPLOYEE, employeeId: emp.id }),
            }))}
          />
        ))}

        {(resources || []).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <CategorySubmenu
              icon={<Package />}
              label={t('appointments:viewMenu.resourceSchedule')}
              allLabel={t('appointments:viewMenu.allResources')}
              onSelectAll={() => onSelect({ kind: VIEW_ALL_RESOURCES })}
              members={resources.map((r) => ({
                id: r.id,
                name: r.name,
                onSelect: () => onSelect({ kind: VIEW_RESOURCE, resourceId: r.id }),
              }))}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
