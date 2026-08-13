import { foldersForStorage, unassignedFolders, isUnassignedFolder, ancestorIds } from './folderStorageScope'
import { ALL_STORAGES } from './storageScope'

const cat = (id, over = {}) => ({
  id, name: id, parent_id: null, sort_order: 1, is_active: true, ...over,
})

// 🔴 الانتماءُ صفوفٌ في `storage_categories`، لا عمودٌ على المجلّد.
//
// وهذا الملفّ كان مكتوبًا بالعمود، وتحويلُه هو نصفُ البيّنة على أن التغيير
// **بنيويٌّ لا تجميليّ**: كلُّ حالةٍ هنا بقيت كما هي، **وواحدةٌ لم تكن قابلةً
// للتعبير أصلًا** — مجلّدٌ في مستودعين. وهي بالضبط الحالةُ التي بُني النموذجُ
// من أجلها، لأن نقلَ البضاعة يشترط أن يحفظ المصدرُ والوجهةُ نفسَ المجلّد.
const link = (storage_id, category_id) => ({ id: `${storage_id}~${category_id}`, storage_id, category_id })

const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'
const THIRD = 'stor-third'

const CATEGORIES = [
  cat('after-laser'), cat('hydration'), cat('peeling'), cat('skin-care'),
  cat('bath'), cat('hair-treatment'),
  // 🔴 THE WITNESS. In the reference this is «Makeup Products» — it appears in
  // the «All storages» tree and in NEITHER of the two named storages. Nothing
  // but «it belongs to a storage that is not on screen» explains it, which is
  // why it is in this fixture rather than a fourth Cosmotology folder.
  cat('makeup'),
]

const LINKS = [
  link(COSMO, 'after-laser'), link(COSMO, 'hydration'),
  link(COSMO, 'peeling'), link(COSMO, 'skin-care'),
  link(HAIR, 'bath'), link(HAIR, 'hair-treatment'),
  link(THIRD, 'makeup'),
]

const ids = (list) => list.map((c) => c.id)

describe('a storage shows its own folders', () => {
  it('shows the four the reference shows for the first storage', () => {
    expect(ids(foldersForStorage(CATEGORIES, COSMO, LINKS)).sort())
      .toEqual(['after-laser', 'hydration', 'peeling', 'skin-care'])
  })

  it('shows an entirely different two for the second — in THIS fixture', () => {
    // ⚠️ **والعنوان يقول «في هذه التجهيزة» عمدًا.** كان يقول «منفصلتان لا
    // متداخلتان — وهذا هو الادّعاء»، وقد صار **خطأً بالنموذج الجديد**: التداخلُ
    // مسموحٌ ومقصود. المنفصلُ خاصّيّةُ هذه البيانات لا خاصّيّةُ الدالّة، والحالةُ
    // المتداخلةُ في الوصف التالي.
    expect(ids(foldersForStorage(CATEGORIES, HAIR, LINKS)).sort()).toEqual(['bath', 'hair-treatment'])
    const cosmo = new Set(ids(foldersForStorage(CATEGORIES, COSMO, LINKS)))
    expect(ids(foldersForStorage(CATEGORIES, HAIR, LINKS)).some((id) => cosmo.has(id))).toBe(false)
  })

  it('shows nothing for a storage nobody linked a folder to', () => {
    // Fails closed: an unknown storage narrows to nothing rather than widening
    // to everything, the same way catalogueScope treats a folder that is gone.
    expect(foldersForStorage(CATEGORIES, 'stor-from-next-year', LINKS)).toEqual([])
  })
})

// 🔴 الحالةُ التي لم يكن العمودُ يقدر يقولها إطلاقًا — وهي سببُ التحويل كلِّه.
describe('a folder lives in more than one storage', () => {
  const SHARED = [...LINKS, link(HAIR, 'skin-care')]

  it('appears in both trees at once', () => {
    expect(ids(foldersForStorage(CATEGORIES, COSMO, SHARED))).toContain('skin-care')
    expect(ids(foldersForStorage(CATEGORIES, HAIR, SHARED))).toContain('skin-care')
  })

  it('is what makes a transfer between the two possible at all', () => {
    // شرطُ النقل أن يحفظ المصدرُ والوجهةُ **نفسَ المجلّد**. فتحت «مجلّد =
    // مستودعٌ واحد» تصير الجملةُ «الوجهةُ = مستودعُه الوحيد» — أي منعَ كلِّ
    // نقل. هذا الوصفُ هو البيّنةُ على أن الشرطَ صار قابلًا للتحقّق.
    const shared = ids(foldersForStorage(CATEGORIES, COSMO, SHARED))
      .filter((id) => ids(foldersForStorage(CATEGORIES, HAIR, SHARED)).includes(id))
    expect(shared).toEqual(['skin-care'])
  })

  it('leaves the others alone', () => {
    // ⚠️ رابطٌ إضافيٌّ لا يوسّع غيرَه: لولا هذا لمرّ تنفيذٌ يتجاهل
    // `storage_id` في الروابط ويرجّع كلَّ مجلّدٍ مربوطٍ بأيّ مكان.
    expect(ids(foldersForStorage(CATEGORIES, HAIR, SHARED)).sort())
      .toEqual(['bath', 'hair-treatment', 'skin-care'])
  })
})

describe('«all storages» is the union and hides nothing', () => {
  it('shows every folder from every storage at once', () => {
    // The reference's third screenshot: seven folders — four plus two plus the
    // one that belongs to neither.
    expect(ids(foldersForStorage(CATEGORIES, ALL_STORAGES, LINKS)).sort()).toEqual([...ids(CATEGORIES)].sort())
    expect(foldersForStorage(CATEGORIES, ALL_STORAGES, LINKS)).toHaveLength(7)
  })

  it('treats «nothing chosen» the same way', () => {
    // '' and null are «no storage in force», which on the catalogue resolves to
    // ALL — so the tree must not empty itself while the lens is still settling.
    expect(foldersForStorage(CATEGORIES, '', LINKS)).toHaveLength(7)
    expect(foldersForStorage(CATEGORIES, null, LINKS)).toHaveLength(7)
    expect(foldersForStorage(CATEGORIES, undefined, LINKS)).toHaveLength(7)
  })
})

describe('a folder no storage keeps yet', () => {
  const WITH_ORPHAN = [...CATEGORIES, cat('legacy'), cat('legacy-2')]

  it('appears under «all storages»', () => {
    expect(ids(foldersForStorage(WITH_ORPHAN, ALL_STORAGES, LINKS))).toContain('legacy')
    expect(ids(foldersForStorage(WITH_ORPHAN, ALL_STORAGES, LINKS))).toContain('legacy-2')
  })

  it('appears under no single storage at all', () => {
    // 🔴 THE DECISION, AND THE OTHER OPTION WAS «show it everywhere».
    // That one degrades to today's behaviour exactly, so nothing would look
    // different and nobody would ever tick a storage — the table would sit
    // empty for months while the screen behaved as though the feature did not
    // exist. Gathering them under «all» is what makes them findable.
    for (const storage of [COSMO, HAIR, THIRD]) {
      expect(ids(foldersForStorage(WITH_ORPHAN, storage, LINKS))).not.toContain('legacy')
      expect(ids(foldersForStorage(WITH_ORPHAN, storage, LINKS))).not.toContain('legacy-2')
    }
  })

  it('is namable, so the screen can point at it', () => {
    // ⚠️ **والمعنى تغيّر والاسمُ بقي:** كان «العمودُ فارغ» وصار «ولا رابطَ له في
    // أيّ مستودع». والفرقُ العمليّ أن الثانية **تُصلَح من الشاشة** لا بسكربت.
    expect(ids(unassignedFolders(WITH_ORPHAN, LINKS))).toEqual(['legacy', 'legacy-2'])
    expect(isUnassignedFolder(cat('legacy'), LINKS)).toBe(true)
    expect(isUnassignedFolder(cat('after-laser'), LINKS)).toBe(false)
    expect(isUnassignedFolder(null, LINKS)).toBe(false)
    // بلا روابطَ إطلاقًا: الكلُّ غيرُ مربوط — وهي حالةُ ما بعد التصفير بالضبط.
    expect(ids(unassignedFolders(CATEGORIES, []))).toEqual(ids(CATEGORIES))
  })
})

describe('a subfolder stays reachable', () => {
  // 🔴 THE HOLE THAT A FLAT FILTER LEAVES, and it is silent: the folder is
  // linked, correct, and invisible.
  //
  // buildProductTree thins the flat list BEFORE walking it, and a child whose
  // parent is missing is not promoted to a root — it vanishes. So a subfolder
  // linked to this storage, under a parent that is not, would be filtered
  // away with its parent and nothing would say so.
  const NESTED = [
    cat('root-unlinked'),
    cat('child-cosmo', { parent_id: 'root-unlinked' }),
    cat('child-hair', { parent_id: 'root-unlinked' }),
  ]
  const NESTED_LINKS = [link(COSMO, 'child-cosmo'), link(HAIR, 'child-hair')]

  it('keeps the ancestors a linked folder hangs from', () => {
    expect(ids(foldersForStorage(NESTED, COSMO, NESTED_LINKS)).sort()).toEqual(['child-cosmo', 'root-unlinked'])
  })

  it('does not drag the siblings in with the spine', () => {
    // ⚠️ THE HALF WORTH CHECKING RATHER THAN ASSUMING. The spine is a parent
    // that is not linked to this storage — so if keeping it also kept its
    // other children, one storage's tree would be showing another storage's
    // folders, and selecting the parent would put their products on screen.
    expect(ids(foldersForStorage(NESTED, COSMO, NESTED_LINKS))).not.toContain('child-hair')
    expect(ids(foldersForStorage(NESTED, HAIR, NESTED_LINKS))).not.toContain('child-cosmo')
  })

  it('walks up more than one level', () => {
    const DEEP = [cat('a'), cat('b', { parent_id: 'a' }), cat('c', { parent_id: 'b' })]
    expect(ids(foldersForStorage(DEEP, COSMO, [link(COSMO, 'c')])).sort()).toEqual(['a', 'b', 'c'])
  })

  // ── The cycle, and the test that used to prove nothing ──────────────────
  //
  // 🔴 THE FIRST VERSION OF THIS WAS A FALSE GREEN, AND INJECTION IS WHAT SAID
  // SO. It built a two-folder loop and then linked a THIRD folder, sitting
  // outside it — so `ancestorIds` was never called on anything inside the
  // cycle, and deleting the cycle guard outright left all twelve tests passing.
  //
  // The claim was «does not hang on a parent chain that loops». The case was «a
  // loop exists somewhere in the list». Those are different sentences, and only
  // the second one was checked.
  describe('a parent chain that loops', () => {
    // The linked folder is INSIDE the cycle now. This is the fixture that
    // makes the walk enter it.
    const LOOP = [
      cat('x', { parent_id: 'y' }),
      cat('y', { parent_id: 'x' }),
      cat('outside'),
    ]

    it('is bounded by the number of folders even with nothing remembered', () => {
      // 🔴 THE SECOND STOPPER, MEASURED RATHER THAN TRUSTED — and it is the one
      // that decides whether a future bad edit HANGS or merely misbehaves.
      //
      // The map counts its reads and throws by name past a sane cap, so this
      // test fails in milliseconds instead of freezing the file. That matters
      // more than it sounds: Jest stops a file at a hang, so every test below
      // this line would silently never run.
      let reads = 0
      const counting = {
        size: LOOP.length,
        get(id) {
          if (++reads > LOOP.length * 4) throw new Error('ancestorIds did not terminate')
          return LOOP.find((c) => c.id === id)
        },
      }
      expect([...ancestorIds(LOOP[0], counting)].sort()).toEqual(['x', 'y'])
      expect(reads).toBeLessThanOrEqual(LOOP.length + 1)
    })

    // 🔴 AND THIS IS THE ONLY CYCLE TEST IN THE FILE, WHICH IS A LIMIT RATHER
    // THAN AN OVERSIGHT — WRITTEN DOWN SO IT IS NOT READ AS COVERAGE.
    //
    // Two more were written and removed: one handing `ancestorIds` a real Map,
    // and one going through `foldersForStorage`, which builds its own Map
    // inside. Both assert real things. Both HANG when the stoppers are removed,
    // and measured: with both gone the whole file froze and Jest printed
    // nothing at all — including the failure of the instrumented test above,
    // which had already fired. A hanging test does not fail loudly; it erases
    // the file's report.
    //
    // ⇒ So the cycle is only ever walked through an index that can refuse. What
    // is NOT covered is `foldersForStorage` on cyclic data — and the honest
    // reason is that the only test for it is one that blinds the suite, not
    // that nobody thought of it.
  })
})
