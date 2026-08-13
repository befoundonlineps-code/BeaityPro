import { supabase } from './supabaseClient'
import { wroteAll } from './writeCheck'
import { keyedLinkDiff } from './resourceLinks'
import { responsibleKey, responsibleRowFor } from './storageForm'
import { folderKey } from './storageFolders'
import { supplierContactPayload, contactIsEmpty } from './supplierForm'

// The writes the storage and supplier screens make.
//
// Separate from productAdminIO.js rather than appended to it: same module,
// different screens, and one file per screen-family is what keeps the tests
// proportionate to what they cover.
//
// No delete for a storage or a supplier, and that is not an omission. Neither
// table has an RLS delete policy, so a delete returns zero rows rather than an
// error — silent success from the client's side. Archiving is the only act,
// and the screens show no delete button at all. Their child tables
// (storage_responsibles, supplier_contacts) do have one, which is why the two
// list diffs below can remove rows.
//
// ⚠️ Both list diffs are several separate writes with no transaction around
// them, the category-1 choice from CLAUDE.md, and for the reason written there:
// this is definitional data. Nothing derives a number from a half-applied
// responsible list or contact list, and saving again fixes it because the diff
// is computed from the rows the screen last read rather than from a picture of
// what was wanted. The stock movements are the other case, and they go through
// an RPC.

export async function saveStorage({ id, payload, salonId }, client = supabase) {
  const { data, error } = id
    ? await client.from('storages').update(payload).eq('id', id).select()
    : await client.from('storages').insert([{ ...payload, salon_id: salonId }]).select()

  if (error) return { ok: false, error, row: null }
  // No error and no rows is a refusal, not a success: RLS declining looks
  // exactly like this from here.
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

export async function setStorageArchived(storageId, archived, client = supabase) {
  const { data, error } = await client
    .from('storages')
    .update({ is_active: !archived })
    .eq('id', storageId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// Who is financially answerable for a storage, made to match what was ticked.
//
// The chosen items arrive as keys — 'employee:<uuid>' or 'role:<role>' — because
// a row names one or the other and never both. keyedLinkDiff turns them into
// the two writes; nothing here re-implements the diff.
export async function saveStorageResponsibles(
  { storageId, salonId, existingRows, selectedKeys },
  client = supabase
) {
  const { toAdd, toRemoveIds } = keyedLinkDiff(existingRows, selectedKeys, responsibleKey)

  // Rows back and counted, the same as every other write in this file — see
  // lib/writeCheck.js. A delete RLS refuses comes back 200 empty.
  if (toRemoveIds.length > 0) {
    const { data, error } = await client
      .from('storage_responsibles').delete().in('id', toRemoveIds).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, toRemoveIds.length)) return { ok: false, error: null }
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((key) => ({
      salon_id: salonId,
      storage_id: storageId,
      ...responsibleRowFor(key),
    }))
    const { data, error } = await client.from('storage_responsibles').insert(rows).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, rows.length)) return { ok: false, error: null }
  }

  return { ok: true, error: null }
}

// 🔴 أيُّ مجلّداتٍ يحفظها هذا المستودع — تشكيلتُه.
//
// نفسُ شكل `saveStorageResponsibles` أعلاه بالضبط: فرقُ روابطَ ثمّ حذفٌ وإدراج،
// والصفوفُ تُقرأ راجعةً وتُعدّ. ولا شيء هنا يُعيد بناء الفرق — `keyedLinkDiff`
// هي هي.
//
// ⚠️ **و`seeded` لا تُذكر إطلاقًا، وذلك هو التصميم.** العمودُ افتراضُه `false`،
// و٠٦٦ب وحدَه كتب `true` صراحةً للبذرة الأولى. فكلُّ إدراجٍ عاديٍّ من هذه
// الشاشة يطلع **قرارَ إنسان** بلا أن تعرف الشاشةُ بوجود العمود — وهو نفسُ سببِ
// كون `NEXT_BUILD_DIR` إعدادًا لا قاعدةً تُتذكَّر: **ما لا يُذكر لا يُنسى.**
//
// ⚠️ **والحذفُ قد يُرفض، وهذا مقصود:** `refuse_unlinking_stocked_folder` مُشغِّلُ
// BEFORE DELETE يرفض شيلَ مجلّدٍ للمستودع رصيدٌ منه. فالخطأُ يرجع كما هو ويمرّ
// على `dbErrorSentence` — والشاشةُ تمنعه قبل ذلك بجملةٍ تسمّي الأصناف
// (lib/storageFolders.js). **القاعدةُ ترفض على أيّ حال؛ الشاشةُ تعطي الجملةَ
// الأفضل.**
export async function saveStorageCategories(
  { storageId, salonId, existingRows, selectedKeys },
  client = supabase
) {
  const { toAdd, toRemoveIds } = keyedLinkDiff(existingRows, selectedKeys, folderKey)

  // ⚠️ الحذفُ أوّلًا كما في الدالّة أعلاه. وهنا له سببٌ إضافيّ: الرفضُ الوحيدُ
  // الممكن يقع على الحذف، فوقوعُه قبل الإدراج يترك الحالةَ كما كانت بدل أن
  // يترك روابطَ جديدةً أُضيفت ثمّ فشل ما بعدها.
  if (toRemoveIds.length > 0) {
    const { data, error } = await client
      .from('storage_categories').delete().in('id', toRemoveIds).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, toRemoveIds.length)) return { ok: false, error: null }
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((categoryId) => ({
      salon_id: salonId,
      storage_id: storageId,
      category_id: categoryId,
    }))
    const { data, error } = await client.from('storage_categories').insert(rows).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, rows.length)) return { ok: false, error: null }
  }

  return { ok: true, error: null }
}

export async function saveSupplier({ id, payload, salonId }, client = supabase) {
  const { data, error } = id
    ? await client.from('suppliers').update(payload).eq('id', id).select()
    : await client.from('suppliers').insert([{ ...payload, salon_id: salonId }]).select()

  if (error) return { ok: false, error, row: null }
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

export async function setSupplierArchived(supplierId, archived, client = supabase) {
  const { data, error } = await client
    .from('suppliers')
    .update({ is_active: !archived })
    .eq('id', supplierId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// The people at a supplier, made to match what was typed.
//
// Diffed by row id rather than by a natural key, unlike the set's components:
// a contact has no column that identifies the person, so two rows reading
// "Sales" with different phone numbers are two contacts and not one edited
// twice. A row the window is still carrying an id for is an edit; one without
// is new; one in the table the window is no longer carrying is gone.
//
// Blank rows are dropped rather than refused. Somebody who presses "add
// contact" and then changes their mind should not have to find the row again
// to delete it — an untouched row expresses nothing. A row with something in
// it but no way to reach the person is a different case and is refused by
// validateSupplierContacts, which runs before this.
export async function saveSupplierContacts(
  { supplierId, salonId, existingRows, contacts },
  client = supabase
) {
  const kept = (contacts || []).filter((c) => !contactIsEmpty(c))
  const keptIds = new Set(kept.map((c) => c.id).filter(Boolean))

  const toRemoveIds = (existingRows || []).filter((r) => !keptIds.has(r.id)).map((r) => r.id)

  if (toRemoveIds.length > 0) {
    const { data, error } = await client
      .from('supplier_contacts').delete().in('id', toRemoveIds).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, toRemoveIds.length)) return { ok: false, error: null }
  }

  // Position in the list is written on every row, edited or new, so that
  // deleting one in the middle renumbers the rest instead of leaving a gap.
  for (const [index, contact] of kept.entries()) {
    const payload = supplierContactPayload(contact, index)
    const { data, error } = contact.id
      ? await client.from('supplier_contacts').update(payload).eq('id', contact.id).select()
      : await client.from('supplier_contacts')
          .insert([{ ...payload, salon_id: salonId, supplier_id: supplierId }]).select()
    if (error) return { ok: false, error }
    if (!wroteAll(data, 1)) return { ok: false, error: null }
  }

  return { ok: true, error: null }
}
