import {
  visibleEmployeesFor,
  visibleResourcesFor,
  rolesInUse,
  isOnShift,
  isWeekView,
  isBroadView,
  DEFAULT_SELECTION,
  VIEW_ALL,
  VIEW_ON_SHIFT,
  VIEW_ROLE,
  VIEW_EMPLOYEE,
  VIEW_RESOURCE,
  VIEW_ALL_RESOURCES,
} from './calendarView'

const RESOURCES = [
  { id: 'r1', name: 'غرفة 1', capacity: 2 },
  { id: 'r2', name: 'جهاز ليزر', capacity: 1 },
]

const EMPLOYEES = [
  { id: 'e1', name: 'لينا', role: 'hairdresser', is_assistant: false },
  { id: 'e2', name: 'سارة', role: 'hairdresser', is_assistant: true },
  { id: 'e3', name: 'نسرين', role: 'masseur', is_assistant: false },
  { id: 'e4', name: 'رنا', role: 'owner', is_assistant: false },
]

// Only e1 and e3 are working the day on screen.
const WINDOWS = {
  e1: [{ startTime: '09:00', endTime: '17:00' }],
  e2: [{ startTime: '09:00', endTime: '17:00' }],
  e3: [{ startTime: '10:00', endTime: '15:00' }],
  e4: [],
}

const ids = (rows) => rows.map((r) => r.id)

describe('isWeekView', () => {
  it('is a week only for a single subject', () => {
    expect(isWeekView({ kind: VIEW_EMPLOYEE, employeeId: 'e1' })).toBe(true)
    expect(isWeekView({ kind: VIEW_RESOURCE, resourceId: 'r1' })).toBe(true)
  })

  it('stays on the day view for every filter mode', () => {
    expect(isWeekView({ kind: VIEW_ALL })).toBe(false)
    expect(isWeekView({ kind: VIEW_ON_SHIFT })).toBe(false)
    expect(isWeekView({ kind: VIEW_ROLE, role: 'hairdresser' })).toBe(false)
    expect(isWeekView(null)).toBe(false)
  })
})

describe('isOnShift', () => {
  it('is true only when the day has a window', () => {
    expect(isOnShift([{ startTime: '09:00', endTime: '17:00' }])).toBe(true)
    expect(isOnShift([])).toBe(false)
    expect(isOnShift(null)).toBe(false)
  })
})

describe('rolesInUse', () => {
  const labelFor = (r) => ({ hairdresser: 'مصفف شعر', masseur: 'أخصائي مساج', owner: 'صاحب العمل' }[r] || r)

  it('offers only roles somebody actually holds', () => {
    // The enum also carries administrator and executive; a salon with neither
    // should not be given a category that opens onto nothing.
    expect(rolesInUse(EMPLOYEES, labelFor).sort()).toEqual(['hairdresser', 'masseur', 'owner'])
  })

  it('lists each role once however many hold it', () => {
    expect(rolesInUse(EMPLOYEES, labelFor).filter((r) => r === 'hairdresser')).toHaveLength(1)
  })

  it('orders by the label on screen, not by enum order', () => {
    // أخصائي مساج · صاحب العمل · مصفف شعر — Arabic collation of the labels,
    // which is nothing like the order the roles arrive in.
    expect(rolesInUse(EMPLOYEES, labelFor)).toEqual(['masseur', 'owner', 'hairdresser'])
  })

  it('copes with nothing at all', () => {
    expect(rolesInUse(null, labelFor)).toEqual([])
    expect(rolesInUse([], labelFor)).toEqual([])
  })
})

describe('visibleEmployeesFor', () => {
  const call = (selection, showAssistants = false) =>
    visibleEmployeesFor({ employees: EMPLOYEES, selection, showAssistants, windowsByEmployee: WINDOWS })

  it('shows everyone but the assistants by default', () => {
    expect(ids(call(DEFAULT_SELECTION))).toEqual(['e1', 'e3', 'e4'])
  })

  it('lets the assistant toggle add them back', () => {
    expect(ids(call({ kind: VIEW_ALL }, true))).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('keeps only those working the day on screen', () => {
    // e4 has no window today, e2 is an assistant and hidden anyway.
    expect(ids(call({ kind: VIEW_ON_SHIFT }))).toEqual(['e1', 'e3'])
  })

  it('still respects the assistant toggle while filtering by shift', () => {
    expect(ids(call({ kind: VIEW_ON_SHIFT }, true))).toEqual(['e1', 'e2', 'e3'])
  })

  it('drops an absent professional from "on shift" without being told', () => {
    // The absence veto already emptied their windows upstream, so nothing
    // here has to know absences exist.
    const windows = { ...WINDOWS, e1: [] }
    const rows = visibleEmployeesFor({
      employees: EMPLOYEES, selection: { kind: VIEW_ON_SHIFT }, showAssistants: false, windowsByEmployee: windows,
    })
    expect(ids(rows)).toEqual(['e3'])
  })

  it('shows a whole role including its assistants', () => {
    // The request named that group, so answering with a silently shorter
    // list would read as missing data rather than as a setting.
    expect(ids(call({ kind: VIEW_ROLE, role: 'hairdresser' }))).toEqual(['e1', 'e2'])
  })

  it('narrows to one professional', () => {
    expect(ids(call({ kind: VIEW_EMPLOYEE, employeeId: 'e3' }))).toEqual(['e3'])
  })

  it('shows no employee columns at all for a resource', () => {
    expect(call({ kind: VIEW_RESOURCE, resourceId: 'r1' })).toEqual([])
    expect(call({ kind: VIEW_ALL_RESOURCES })).toEqual([])
  })

  it('falls back to the default view rather than emptying the board', () => {
    expect(ids(call(null))).toEqual(['e1', 'e3', 'e4'])
    expect(ids(call({}))).toEqual(['e1', 'e3', 'e4'])
  })

  it('copes with no employees', () => {
    expect(visibleEmployeesFor({ employees: null, selection: DEFAULT_SELECTION })).toEqual([])
  })
})

describe('isBroadView', () => {
  it('is true only for the two views of the whole salon', () => {
    expect(isBroadView({ kind: VIEW_ALL })).toBe(true)
    expect(isBroadView({ kind: VIEW_ON_SHIFT })).toBe(true)
    expect(isBroadView(null)).toBe(true)
  })

  it('is false for every narrowing', () => {
    expect(isBroadView({ kind: VIEW_ROLE, role: 'masseur' })).toBe(false)
    expect(isBroadView({ kind: VIEW_EMPLOYEE, employeeId: 'e1' })).toBe(false)
    expect(isBroadView({ kind: VIEW_RESOURCE, resourceId: 'r1' })).toBe(false)
    expect(isBroadView({ kind: VIEW_ALL_RESOURCES })).toBe(false)
  })
})

describe('visibleResourcesFor', () => {
  const call = (selection) => visibleResourcesFor({ resources: RESOURCES, selection })
  const rids = (rows) => rows.map((r) => r.id)

  it('keeps every resource on the two broad views', () => {
    expect(rids(call({ kind: VIEW_ALL }))).toEqual(['r1', 'r2'])
    expect(rids(call({ kind: VIEW_ON_SHIFT }))).toEqual(['r1', 'r2'])
  })

  it('drops them entirely once the board narrows to people', () => {
    // Asking for the hairdressers and still being handed every treatment bed
    // is the same board with some columns missing, not a narrower one.
    expect(call({ kind: VIEW_ROLE, role: 'hairdresser' })).toEqual([])
    expect(call({ kind: VIEW_EMPLOYEE, employeeId: 'e1' })).toEqual([])
  })

  it('narrows to the one resource asked for', () => {
    expect(rids(call({ kind: VIEW_RESOURCE, resourceId: 'r2' }))).toEqual(['r2'])
  })

  it('shows them all when the resources themselves are the subject', () => {
    expect(rids(call({ kind: VIEW_ALL_RESOURCES }))).toEqual(['r1', 'r2'])
  })

  it('falls back to showing everything rather than emptying the board', () => {
    expect(rids(call(null))).toEqual(['r1', 'r2'])
    expect(rids(call({}))).toEqual(['r1', 'r2'])
  })

  it('copes with no resources', () => {
    expect(visibleResourcesFor({ resources: null, selection: DEFAULT_SELECTION })).toEqual([])
  })
})
