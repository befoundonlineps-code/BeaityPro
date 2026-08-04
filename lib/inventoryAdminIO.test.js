import { saveStorageResponsibles, saveSupplierContacts } from './inventoryAdminIO'

// Only the two list diffs are covered. The four single-row writes go through a
// chained PostgREST builder, and a fake of that chain would be a test of the
// fake — what they send is decided in storageForm.js and supplierForm.js,
// which are tested directly. A diff is different: it is a decision.
//
// ⚠️ Every verb ends in .select() and hands back rows: a write RLS refused is
// 200 with an empty body, so counting the rows is the only thing that tells it
// apart from a success. `refuse` makes one verb answer that way.
function fakeClient(refuse = {}) {
  const calls = []
  const answer = (verb, rows) => ({ data: refuse[verb] ? [] : rows, error: null })
  const table = (name) => ({
    delete: () => ({ in: (col, ids) => ({ select: () => {
      calls.push(['delete', name, col, ids])
      return answer('delete', ids.map((id) => ({ id })))
    } }) }),
    update: (patch) => ({ eq: (col, id) => ({ select: () => {
      calls.push(['update', name, id, patch])
      return answer('update', [{ id }])
    } }) }),
    insert: (rows) => ({ select: () => {
      calls.push(['insert', name, rows])
      return answer('insert', rows.map((r, i) => ({ id: `new${i}`, ...r })))
    } }),
  })
  return { client: { from: table }, calls }
}

describe('saveStorageResponsibles', () => {
  const empRow = (id, employeeId) => ({ id, employee_id: employeeId, role: null })
  const roleRow = (id, role) => ({ id, employee_id: null, role })

  it('inserts an employee and a role as the exclusive-or the CHECK demands', async () => {
    const { client, calls } = fakeClient()
    await saveStorageResponsibles({
      storageId: 'st1', salonId: 'sal1', existingRows: [],
      selectedKeys: ['employee:e1', 'role:hairdresser'],
    }, client)

    expect(calls).toEqual([['insert', 'storage_responsibles', [
      { salon_id: 'sal1', storage_id: 'st1', employee_id: 'e1', role: null },
      { salon_id: 'sal1', storage_id: 'st1', employee_id: null, role: 'hairdresser' },
    ]]])
  })

  it('removes what was unticked and leaves the rest alone', async () => {
    const { client, calls } = fakeClient()
    await saveStorageResponsibles({
      storageId: 'st1', salonId: 'sal1',
      existingRows: [empRow('r1', 'e1'), roleRow('r2', 'owner')],
      selectedKeys: ['employee:e1'],
    }, client)

    expect(calls).toEqual([['delete', 'storage_responsibles', 'id', ['r2']]])
  })

  it('does nothing at all when the ticks did not change', async () => {
    const { client, calls } = fakeClient()
    await saveStorageResponsibles({
      storageId: 'st1', salonId: 'sal1',
      existingRows: [empRow('r1', 'e1'), roleRow('r2', 'owner')],
      selectedKeys: ['role:owner', 'employee:e1'],
    }, client)

    expect(calls).toEqual([])
  })

  it('never confuses an employee with a role that shares its name', async () => {
    // The prefix is why. unique(storage_id, employee_id) and unique(storage_id,
    // role) are separate constraints, so both rows are legal at once — and an
    // unprefixed key would have made one of them delete the other.
    const { client, calls } = fakeClient()
    await saveStorageResponsibles({
      storageId: 'st1', salonId: 'sal1',
      existingRows: [roleRow('r1', 'owner')],
      selectedKeys: ['role:owner', 'employee:owner'],
    }, client)

    expect(calls).toEqual([['insert', 'storage_responsibles', [
      { salon_id: 'sal1', storage_id: 'st1', employee_id: 'owner', role: null },
    ]]])
  })
})

describe('saveSupplierContacts', () => {
  const row = (id, firstName) => ({ id, first_name: firstName })

  it('inserts a new contact with its place in the list', async () => {
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1', existingRows: [],
      contacts: [{ firstName: 'سارة', phone: '0599' }],
    }, client)

    expect(calls).toEqual([['insert', 'supplier_contacts', [{
      salon_id: 'sal1', supplier_id: 'sup1',
      last_name: null, first_name: 'سارة', position: null, phone: '0599',
      email: null, notes: null, sort_order: 0,
    }]]])
  })

  it('updates a contact it is still carrying an id for', async () => {
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1', existingRows: [row('c1', 'سارة')],
      contacts: [{ id: 'c1', firstName: 'سارة', phone: '0599' }],
    }, client)

    expect(calls).toEqual([['update', 'supplier_contacts', 'c1', {
      last_name: null, first_name: 'سارة', position: null, phone: '0599',
      email: null, notes: null, sort_order: 0,
    }]])
  })

  it('deletes a row the window is no longer carrying', async () => {
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1',
      existingRows: [row('c1', 'سارة'), row('c2', 'خالد')],
      contacts: [{ id: 'c2', firstName: 'خالد' }],
    }, client)

    expect(calls[0]).toEqual(['delete', 'supplier_contacts', 'id', ['c1']])
  })

  it('deletes before it writes, so a removed row cannot outlive the save', async () => {
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1', existingRows: [row('c1', 'سارة')],
      contacts: [{ firstName: 'خالد' }],
    }, client)

    expect(calls.map((c) => c[0])).toEqual(['delete', 'insert'])
  })

  it('drops an untouched blank row instead of writing it', async () => {
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1', existingRows: [],
      contacts: [{}, { firstName: 'سارة' }],
    }, client)

    expect(calls).toEqual([['insert', 'supplier_contacts', [{
      salon_id: 'sal1', supplier_id: 'sup1',
      last_name: null, first_name: 'سارة', position: null, phone: null,
      email: null, notes: null, sort_order: 0,
    }]]])
  })

  it('renumbers the rows left behind when one in the middle goes', async () => {
    // Whoever ordered them meant it, and .order('sort_order') has nothing else
    // to go on.
    const { client, calls } = fakeClient()
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1',
      existingRows: [row('c1', 'أ'), row('c2', 'ب'), row('c3', 'ج')],
      contacts: [{ id: 'c1', firstName: 'أ' }, { id: 'c3', firstName: 'ج' }],
    }, client)

    expect(calls).toEqual([
      ['delete', 'supplier_contacts', 'id', ['c2']],
      ['update', 'supplier_contacts', 'c1', expect.objectContaining({ sort_order: 0 })],
      ['update', 'supplier_contacts', 'c3', expect.objectContaining({ sort_order: 1 })],
    ])
  })
})

describe('a write that changed nothing is a refusal in both diffs', () => {
  // Same rule as productAdminIO: under RLS a delete or an update no policy
  // allows is 200 with an empty body, and only the insert raises.
  it('catches a refused delete and a refused insert on the responsibles', async () => {
    const args = {
      storageId: 'st1', salonId: 'sal1',
      existingRows: [{ id: 'r1', employee_id: 'e1', role: null }],
      selectedKeys: ['role:owner'],
    }
    expect((await saveStorageResponsibles(args, fakeClient({ delete: true }).client)).ok).toBe(false)
    expect((await saveStorageResponsibles(args, fakeClient({ insert: true }).client)).ok).toBe(false)
    expect((await saveStorageResponsibles(args, fakeClient().client)).ok).toBe(true)
  })

  it('catches a refused delete, update and insert on the contacts', async () => {
    const args = {
      supplierId: 'sup1', salonId: 'sal1',
      existingRows: [{ id: 'c1' }, { id: 'c2' }],
      contacts: [{ id: 'c2', firstName: 'خالد' }, { firstName: 'سارة' }],
    }
    expect((await saveSupplierContacts(args, fakeClient({ delete: true }).client)).ok).toBe(false)
    expect((await saveSupplierContacts(args, fakeClient({ update: true }).client)).ok).toBe(false)
    expect((await saveSupplierContacts(args, fakeClient({ insert: true }).client)).ok).toBe(false)
    expect((await saveSupplierContacts(args, fakeClient().client)).ok).toBe(true)
  })

  it('stops at the first refusal rather than writing on top of it', async () => {
    const { client, calls } = fakeClient({ delete: true })
    await saveSupplierContacts({
      supplierId: 'sup1', salonId: 'sal1',
      existingRows: [{ id: 'c1' }],
      contacts: [{ firstName: 'سارة' }],
    }, client)
    expect(calls.map((c) => c[0])).toEqual(['delete'])
  })
})
