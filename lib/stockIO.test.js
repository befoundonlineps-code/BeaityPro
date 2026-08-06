import { postStockDocument, transferStock, reverseStockDocument } from './stockIO'

// A fake client, which is the whole reason these take one. What needs
// checking is that the right function was called with the right arguments —
// and nothing else here decides anything, so nothing else needs a test.
function fakeClient(result = { data: 'doc-1', error: null }) {
  const rpc = jest.fn(async () => result)
  return { client: { rpc }, rpc }
}

const LINES = [{ product_id: 'p1', quantity_base: 500, unit_cost: 1 }]

describe('postStockDocument', () => {
  it('calls the function by name with every parameter', () => {
    const { client, rpc } = fakeClient()
    postStockDocument({
      docType: 'supply', storageId: 's1', lines: LINES,
      supplierId: 'sup1', employeeId: 'e1', appointmentId: null,
      docDate: '2026-08-04T10:00:00Z', note: 'فاتورة 42',
      supplierDocNumber: '01',
    }, client)

    expect(rpc).toHaveBeenCalledWith('post_stock_document', {
      p_doc_type: 'supply',
      p_storage_id: 's1',
      p_lines: LINES,
      p_supplier_id: 'sup1',
      p_employee_id: 'e1',
      p_appointment_id: null,
      p_doc_date: '2026-08-04T10:00:00Z',
      p_note: 'فاتورة 42',
      p_supplier_doc_number: '01',
    })
  })

  it('sends null rather than undefined for what was left out', () => {
    // PostgREST matches an overload by the parameters present. undefined
    // disappears from the JSON body, so the call can miss the signature
    // entirely and fail as "function not found" instead of using its default.
    const { client, rpc } = fakeClient()
    postStockDocument({ docType: 'write_off', storageId: 's1', lines: LINES }, client)

    const args = rpc.mock.calls[0][1]
    for (const key of ['p_supplier_id', 'p_employee_id', 'p_appointment_id', 'p_doc_date', 'p_note']) {
      expect(args[key]).toBeNull()
    }
  })

  it('returns the new document id', async () => {
    const { client } = fakeClient({ data: 'doc-9', error: null })
    expect(await postStockDocument({ docType: 'supply', storageId: 's1', lines: LINES }, client))
      .toEqual({ ok: true, error: null, documentId: 'doc-9' })
  })

  it('reports an error rather than swallowing it', async () => {
    const error = { code: 'P0001', message: 'unit_cost_required' }
    const { client } = fakeClient({ data: null, error })
    expect(await postStockDocument({ docType: 'supply', storageId: 's1', lines: LINES }, client))
      .toEqual({ ok: false, error, documentId: null })
  })

  it('treats nothing back as a refusal, not a success', async () => {
    // The function returns the document's id. No error and no id is what RLS
    // declining looks like from here — the same rule every write follows.
    const { client } = fakeClient({ data: null, error: null })
    expect(await postStockDocument({ docType: 'supply', storageId: 's1', lines: LINES }, client))
      .toEqual({ ok: false, error: null, documentId: null })
  })
})

describe('transferStock', () => {
  it('calls its own function with both storages', () => {
    // Not post_stock_document with an extra parameter: a signature that
    // accepts invalid combinations moves the guard into application code.
    const { client, rpc } = fakeClient()
    transferStock({ fromStorageId: 'a', toStorageId: 'b', lines: LINES, employeeId: 'e1' }, client)

    expect(rpc).toHaveBeenCalledWith('transfer_stock', {
      p_from_storage_id: 'a',
      p_to_storage_id: 'b',
      p_lines: LINES,
      p_employee_id: 'e1',
      p_doc_date: null,
      p_note: null,
    })
  })

  it('reports a refusal', async () => {
    const error = { code: 'P0001', message: 'transfer_same_storage' }
    const { client } = fakeClient({ data: null, error })
    expect((await transferStock({ fromStorageId: 'a', toStorageId: 'a', lines: LINES }, client)).ok)
      .toBe(false)
  })
})

describe('reverseStockDocument', () => {
  it('sends the document id and nothing that could change what it reverses', () => {
    // No lines parameter at all. Supplying them would let a caller reverse
    // something else, or the same thing at today's average — and the
    // difference would sit in the ledger with nothing to explain it.
    const { client, rpc } = fakeClient()
    reverseStockDocument({ documentId: 'doc-1', note: 'تصحيح' }, client)

    expect(rpc).toHaveBeenCalledWith('reverse_stock_document', {
      p_document_id: 'doc-1',
      p_note: 'تصحيح',
    })
    expect(Object.keys(rpc.mock.calls[0][1])).toEqual(['p_document_id', 'p_note'])
  })

  it('returns the reversing document id', async () => {
    const { client } = fakeClient({ data: 'doc-rev', error: null })
    expect((await reverseStockDocument({ documentId: 'doc-1' }, client)).documentId).toBe('doc-rev')
  })
})

describe('the supplier document number', () => {
  it('is sent as null when nothing was typed', () => {
    // ⚠️ null and never ''. Two ways to say "no external reference" would mean
    // the filter sees one and not the other, and every count of "documents
    // carrying a number" would be wrong — the Number('') family, pointed at a
    // reference instead of a quantity.
    const { client, rpc } = fakeClient()
    postStockDocument({ docType: 'supply', storageId: 's1', lines: LINES }, client)
    expect(rpc.mock.calls[0][1].p_supplier_doc_number).toBeNull()
  })

  it('is still sent when the caller omits it entirely', () => {
    // The parameter has DEFAULT NULL in the function, so the migration and this
    // code do not have to ship together in either order. Sending it explicitly
    // keeps PostgREST's overload matching unambiguous — the reason the test
    // above this describe block exists.
    const { client, rpc } = fakeClient()
    postStockDocument({ docType: 'write_off', storageId: 's1', lines: LINES }, client)
    expect('p_supplier_doc_number' in rpc.mock.calls[0][1]).toBe(true)
  })
})
