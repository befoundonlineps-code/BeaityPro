import { storagesForNewFolder, canCreateFolder, parentChoicesForFolder } from './folderStorageInherit'
import { ALL_STORAGES } from './storageScope'

const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'

const folder = (id = 'parent') => ({ id, name: id, parent_id: null })
const link = (storage_id, category_id) => ({ id: `${storage_id}~${category_id}`, storage_id, category_id })

describe('a new folder takes its storages from the context, never from a question', () => {
  it('takes the selected storage when there is no parent', () => {
    expect(storagesForNewFolder({ parent: null, lensStorageId: COSMO, links: [] })).toEqual([COSMO])
  })

  it('takes ALL of the parent’s storages, not one of them', () => {
    // 🔴 قرارُ المالك، والحجّةُ بنيويّة: البديلُ (رابطُ العدسة وحدَها) يجعل
    // الأبَ **عقدةً معلَّقةً فورًا** في باقي مستودعاته — أي أن الإنشاءَ العاديّ
    // يُنتج الحالةَ الشاذّة التي بُني `isPassThroughFolder` ليستوعبها لا
    // ليولّدها.
    const links = [link(COSMO, 'parent'), link(HAIR, 'parent')]
    expect(storagesForNewFolder({ parent: folder(), lensStorageId: COSMO, links }).sort())
      .toEqual([COSMO, HAIR].sort())
  })

  it('keeps the child’s storages a subset of its parent’s — so it cannot be born pass-through', () => {
    // ⚠️ هذه هي الخاصّيّةُ التي يشتريها القرار، وهي التي تُختبَر — لا صيغةُ
    // التنفيذ. `child ⊆ parent` معناها أنه ما من مستودعٍ يظهر فيه الابنُ ولا
    // يظهر فيه أبوه.
    const links = [link(COSMO, 'parent'), link(HAIR, 'parent')]
    const parentStorages = new Set(links.filter((l) => l.category_id === 'parent').map((l) => l.storage_id))
    for (const s of storagesForNewFolder({ parent: folder(), lensStorageId: ALL_STORAGES, links })) {
      expect(parentStorages.has(s)).toBe(true)
    }
  })

  it('lets the parent win over the picker, not the other way round', () => {
    // 🔴 THE ORDER IS THE POINT, and getting it backwards builds a broken tree
    // rather than a wrong field.
    const links = [link(HAIR, 'parent')]
    expect(storagesForNewFolder({ parent: folder(), lensStorageId: ALL_STORAGES, links })).toEqual([HAIR])
    expect(storagesForNewFolder({ parent: folder(), lensStorageId: COSMO, links })).toEqual([HAIR])
  })

  it('does not repeat a storage the links name twice', () => {
    // صفٌّ مكرَّرٌ يمنعه `unique(storage_id, category_id)` بالقاعدة — والإدراجُ
    // المكرَّر هنا يُسقط الدفعةَ كلَّها، الصفوفَ السليمة معها.
    const links = [link(COSMO, 'parent'), link(COSMO, 'parent')]
    expect(storagesForNewFolder({ parent: folder(), lensStorageId: null, links })).toEqual([COSMO])
  })
})

describe('no context means no folder, rather than a guess', () => {
  it('refuses when the lens is wide and nothing is selected', () => {
    // The owner's rule, in his words: «ما في سياق تلقائي نقدر ناخده منه، فما
    // منخمّن».
    expect(storagesForNewFolder({ parent: null, lensStorageId: ALL_STORAGES, links: [] })).toEqual([])
    expect(storagesForNewFolder({ parent: null, lensStorageId: '', links: [] })).toEqual([])
    expect(storagesForNewFolder({ parent: null, lensStorageId: null, links: [] })).toEqual([])
    expect(storagesForNewFolder({})).toEqual([])
  })

  it('refuses under a parent no storage keeps either', () => {
    // ⚠️ Inheriting «kept nowhere» would be inheriting exactly — and it would
    // also mint a NEW unlinked folder, in a design whose whole point is that
    // the unlinked state stops being reachable by accident.
    expect(storagesForNewFolder({ parent: folder(), lensStorageId: COSMO, links: [] })).toEqual([])
    expect(storagesForNewFolder({
      parent: folder(), lensStorageId: ALL_STORAGES, links: [link(COSMO, 'someone-else')],
    })).toEqual([])
  })
})

describe('the button and the write read the same answer', () => {
  // 🔴 DERIVED, NOT A SECOND CONDITION. A separate rule on the button — «disable
  // when the lens is all storages» — is the second list that drifts.
  const links = [link(HAIR, 'parent')]

  it('allows exactly the cases that produce a storage', () => {
    const cases = [
      { parent: null, lensStorageId: COSMO, links },
      { parent: folder(), lensStorageId: COSMO, links },
      { parent: folder(), lensStorageId: ALL_STORAGES, links },
      { parent: null, lensStorageId: ALL_STORAGES, links },
      { parent: folder('orphan'), lensStorageId: ALL_STORAGES, links },
      {},
    ]
    for (const context of cases) {
      expect(canCreateFolder(context)).toBe(storagesForNewFolder(context).length > 0)
    }
  })

  it('allows a subfolder under a kept parent even while the lens is wide', () => {
    // ⚠️ THE CASE WHERE THE OWNER'S SENTENCE AND ITS REASON PART. «Disable at
    // all storages» read literally forbids this; «there is no context to take
    // from» does not apply, because the parent IS the context.
    expect(canCreateFolder({ parent: folder(), lensStorageId: ALL_STORAGES, links })).toBe(true)
  })

  it('forbids a root folder while the lens is wide', () => {
    expect(canCreateFolder({ parent: null, lensStorageId: ALL_STORAGES, links })).toBe(false)
  })
})

describe('the parent list never offers a folder that would hide the new one', () => {
  const categories = [
    { id: 'here', name: 'here', parent_id: null },
    { id: 'elsewhere', name: 'elsewhere', parent_id: null },
    { id: 'nowhere', name: 'nowhere', parent_id: null },
  ]
  const links = [link(COSMO, 'here'), link(HAIR, 'elsewhere')]
  const names = (list) => list.map((c) => c.id).sort()

  it('drops a parent this storage does not keep — on CREATE', () => {
    // كلُّ مجلّدٍ يُنشأ يظهر في الشجرة التي أُنشئ منها: أبٌ من مستودعٍ آخر
    // يجعل الابنَ يولد غيرَ مرئيّ.
    expect(names(parentChoicesForFolder({ category: null, categories, lensStorageId: COSMO, links })))
      .toEqual(['here'])
  })

  it('leaves the list whole on EDIT — and that is a fault, not a preference', () => {
    // 🔴 التعديلُ يفتح على `parent_id` القائم، وقد يكون في مستودعٍ آخر. فتضييقُ
    // القائمة هناك يُخرج الأبَ الحاليَّ من الخيارات، فتسقط القائمةُ إلى «بلا»،
    // **ويُعيد الحفظُ المجلّدَ إلى الجذر بلا أن يطلب ذلك أحد.**
    expect(names(parentChoicesForFolder({
      category: { id: 'child', parent_id: 'elsewhere' }, categories, lensStorageId: COSMO, links,
    }))).toEqual(['elsewhere', 'here', 'nowhere'])
  })

  it('offers everything while the lens is wide', () => {
    expect(names(parentChoicesForFolder({ category: null, categories, lensStorageId: ALL_STORAGES, links })))
      .toEqual(['elsewhere', 'here', 'nowhere'])
  })
})
