const fs = require('fs')
const path = require('path')
import { folderKey, folderLinksFor, folderTickRows, stockedFolders, blockedUnticks } from './storageFolders'

// 🔴 تشكيلةُ المستودع: أيُّ مجلّداتٍ مسموحٌ تكون فيه — والمجلّدُ يقدر يكون بأكتر
// من مستودع.
//
// القرار: قيدُ التشكيلة مطلوبٌ «من الأول صح، بلا اعتماد على انتباه الموظف».
// وتحت «مجلّد = مستودعٌ واحد» القيدُ **غيرُ قابلٍ للتعبير أصلًا**: «الوجهةُ لازم
// تحفظ هالمجلّد» تصير «الوجهةُ = مستودعُه الوحيد»، أي منعَ كلِّ نقل.
const S1 = 'stor-1'
const S2 = 'stor-2'

const CATEGORIES = [
  { id: 'c-hair', parent_id: null, name: 'شعر', sort_order: 1, is_active: true },
  { id: 'c-shampoo', parent_id: 'c-hair', name: 'شامبو', sort_order: 1, is_active: true },
  { id: 'c-nails', parent_id: null, name: 'أظافر', sort_order: 2, is_active: true },
  { id: 'c-old', parent_id: null, name: 'قديم', sort_order: 3, is_active: false },
]

const PRODUCTS = [
  { id: 'p-shampoo', name: 'شامبو الأطفال', category_id: 'c-shampoo' },
  { id: 'p-file', name: 'مبرد', category_id: 'c-nails' },
  { id: 'p-dye', name: 'صبغة', category_id: 'c-hair' },
]

// ⚠️ `p-file` رصيدُه صفرٌ عمدًا، و`p-dye` رصيدُه في المستودع الآخر عمدًا —
// الاثنان يمرّان بأيّ تنفيذٍ يقول «في صفٌّ للمنتج» بدل «الرصيدُ غيرُ صفريّ هنا».
const BALANCES = [
  { product_id: 'p-shampoo', storage_id: S1, balance_base: 5 },
  { product_id: 'p-file', storage_id: S1, balance_base: 0 },
  { product_id: 'p-dye', storage_id: S2, balance_base: 3 },
]

describe('which folders cannot be un-ticked from a storage', () => {
  const stocked = () => stockedFolders({
    storageId: S1, categories: CATEGORIES, products: PRODUCTS, balances: BALANCES,
  })

  it('counts a product in a DESCENDANT folder, not only a direct child', () => {
    // 🔴 الحالةُ الحاسمة، وهي سببُ وجود المشية أصلًا (٠٦٨أ): شيلُ «شعر» بينما
    // ابنُه «شامبو» مؤشَّر يترك الابنَ خارج الشجرة — `buildCategoryTree` ينزل من
    // المجلّدات بلا أب، فابنٌ فقد أباه ليس جذرًا ولا يُرسَم. رصيدُه في مكانه ولا
    // شيء يعرضه.
    expect(stocked().get('c-hair')).toEqual(['شامبو الأطفال'])
    expect(stocked().get('c-shampoo')).toEqual(['شامبو الأطفال'])
  })

  it('ignores a zero balance', () => {
    // صفرٌ جوابٌ لا رصيد. ومجلّدٌ يُمنع شيلُه لأن منتجًا فيه سبق أن تحرّك ثمّ نفد
    // هو قفلٌ لا يفتحه شيء.
    expect(stocked().has('c-nails')).toBe(false)
  })

  it('ignores stock in another storage', () => {
    // ⚠️ «صبغة» لها رصيدٌ في S2 ومجلّدُها `c-hair`. لو ضاع مرشِّحُ المستودع
    // لظهرت هنا — والاختبارُ فوق كان سيمرّ على أيّ حال لأنه يتوقّع اسمًا واحدًا،
    // فهذه هي التي تبيت المرشِّح.
    expect(stocked().get('c-hair')).not.toContain('صبغة')
    expect(stockedFolders({
      storageId: S2, categories: CATEGORIES, products: PRODUCTS, balances: BALANCES,
    }).get('c-hair')).toEqual(['صبغة'])
  })

  it('says nothing at all with no storage', () => {
    expect(stockedFolders({ storageId: null, categories: CATEGORIES, products: PRODUCTS, balances: BALANCES }).size).toBe(0)
    expect(stockedFolders({}).size).toBe(0)
  })
})

describe('the save is blocked by what was REMOVED, not by what is stocked', () => {
  const stocked = stockedFolders({
    storageId: S1, categories: CATEGORIES, products: PRODUCTS, balances: BALANCES,
  })
  const all = ['c-hair', 'c-shampoo', 'c-nails']

  it('blocks un-ticking a stocked folder, and names its products', () => {
    const blocked = blockedUnticks({ existingKeys: all, selectedKeys: ['c-nails'], stocked })
    expect(blocked.map((b) => b.categoryId).sort()).toEqual(['c-hair', 'c-shampoo'])
    expect(blocked[0].products.length).toBeGreaterThan(0)
  })

  it('does NOT block a stocked folder that stays ticked', () => {
    // 🔴 الفرقُ ليس دقّةً زائدة. منعُ الحفظ لوجودِ رصيدٍ في مجلّدٍ **لم يُلمَس**
    // يجعل نافذةَ مستودعٍ عامرٍ غيرَ قابلةٍ للحفظ إطلاقًا — فتصير القاعدةُ التي
    // تحمي البضاعةَ هي التي تقفل الشاشة.
    expect(blockedUnticks({ existingKeys: all, selectedKeys: all, stocked })).toEqual([])
  })

  it('does not block un-ticking an empty folder', () => {
    expect(blockedUnticks({ existingKeys: all, selectedKeys: ['c-hair', 'c-shampoo'], stocked })).toEqual([])
  })

  it('does not block a folder that was never ticked', () => {
    expect(blockedUnticks({ existingKeys: [], selectedKeys: [], stocked })).toEqual([])
  })
})

describe('the tick list is drawn in tree order', () => {
  it('puts a subfolder under its parent, with a depth', () => {
    // ⚠️ قائمةٌ مسطّحةٌ تضع «شامبو» بعيدًا عن «شعر» تجعل التأشيرَ تخمينًا:
    // الرصيدُ الممنوعُ من الشيل قد يكون في ابنٍ لا في الأب نفسه.
    expect(folderTickRows(CATEGORIES).map((r) => [r.id, r.depth])).toEqual([
      ['c-hair', 0], ['c-shampoo', 1], ['c-nails', 0], ['c-old', 0],
    ])
  })

  it('keeps an archived folder rather than filtering it out', () => {
    // 🔴 مرشِّحُ عرضٍ يصير حذفًا: رابطٌ قائمٌ لمجلّدٍ مؤرشَفٍ لا يظهر في اللوح
    // **يشيله أوّلُ حفظ**، لأن `keyedLinkDiff` يحذف كلَّ ما ليس مؤشَّرًا.
    const old = folderTickRows(CATEGORIES).find((r) => r.id === 'c-old')
    expect(old).toBeTruthy()
    expect(old.archived).toBe(true)
  })
})

describe('the link rows', () => {
  const LINKS = [
    { id: 'l1', storage_id: S1, category_id: 'c-hair' },
    { id: 'l2', storage_id: S2, category_id: 'c-hair' },
  ]

  it('keys on the folder, and narrows to one storage', () => {
    expect(folderKey(LINKS[0])).toBe('c-hair')
    expect(folderLinksFor(LINKS, S1).map((r) => r.id)).toEqual(['l1'])
    expect(folderLinksFor(LINKS, null)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('the window is wired to the rule, and the page feeds it', () => {
  // ⚠️ حارسُ توصيلٍ يقرأ المصدر، لأن النافذةَ **لا تُرسَم بفحصٍ ساكن**: مقيسٌ
  // في هذه الجلسة — `renderToStaticMarkup` يرجّع نصًّا فارغًا لأن الحوارَ
  // يُبوَّب (portal). فالمنطقُ كلُّه في هذا الملفّ حيث يُختبَر فعلًا، **ويبقى
  // سؤالٌ واحدٌ لا يجيب عنه اختبارُ منطق: هل النافذةُ تناديه؟**
  const ROOT = path.join(__dirname, '..')
  const dialog = fs.readFileSync(path.join(ROOT, 'components', 'StorageFormDialog.js'), 'utf8')
  const manager = fs.readFileSync(path.join(ROOT, 'components', 'StoragesManager.js'), 'utf8')
  const page = fs.readFileSync(path.join(ROOT, 'pages', 'products', 'index.js'), 'utf8')
  const hook = fs.readFileSync(path.join(ROOT, 'hooks', 'useInventoryDirectories.js'), 'utf8')

  // ما بين بداية الحفظ وأوّل كتابة. الرفضُ يجب أن يعيش هنا: `saveStorage` يكتب
  // المستودعَ نفسَه، فرفضٌ بعده يترك اسمًا محفوظًا وتشكيلةً مرفوضة.
  const beforeFirstWrite = dialog.slice(
    dialog.indexOf('async function handleSave'),
    dialog.indexOf('await saveStorage(')
  )

  it('found the region it checks', () => {
    // مقطعٌ فارغٌ يجعل كلَّ ما تحته يمرّ — وهو أعلى صور النجاح صوتًا.
    expect(beforeFirstWrite.length).toBeGreaterThan(200)
  })

  it('refuses before the first write — and the refusal is taken, not merely mentioned', () => {
    // 🔴 هذا الاختبارُ كان أضعفَ من عنوانه مرّتين، **وكشفَته بيّنةٌ مضادّة في
    // المرّتين.** الصياغةُ الأولى اكتفت بأن `blockedUnticks(` مذكورةٌ قبل
    // `saveStorage(`؛ والثانيةُ أضافت `if (blocked.length > 0)` كنصّ. وحقنةٌ
    // واحدةٌ مرّت من الاثنتين:
    //
    //   const blocked = blockedUnticks({…})  ⟶  const blockedLater = () => …
    //
    // أي **دالّةٌ لا تُنادى أبدًا**، بينما بقي `if (blocked.length > 0)` في
    // النصّ كما هو. الشيفرةُ ترمي عند التشغيل والحزمةُ خضراء بالكامل.
    //
    // ⚠️ **و`eslint` صامتٌ عنها كذلك — مقيسٌ لا مفترَض:** شُغّل على الملفّ
    // المحقون فأعطى صفرَ ملاحظات (`no-undef` مُطفأةٌ في إعداد Next).
    //
    // ⇒ فالفحصُ صار **على الشكل لا على الاسم**: النتيجةُ تُربَط باسم، **وذلك
    // الاسمُ نفسُه** هو الذي يُختبَر. أيًّا كان الاسم، والحقنةُ لا تمرّ لأنها
    // تربط دالّةً لا نتيجة.
    const bound = /const (\w+) = blockedUnticks\(\{/.exec(beforeFirstWrite)
    expect(bound).toBeTruthy()
    expect(beforeFirstWrite).toMatch(new RegExp(`if \\(${bound[1]}\\.length > 0\\)`))
    expect(beforeFirstWrite).toMatch(/folderStillStockedError/)
    expect(beforeFirstWrite).toMatch(/return\s*\n/)
  })

  it('says what it cannot check, rather than being read as more', () => {
    // ⚠️ حدُّ هذا الحارس: يقرأ نصًّا. يثبت أن **شكلَ** الرفض موجودٌ ومربوطٌ قبل
    // أوّل كتابة، **ولا يثبت أنه يُنفَّذ**. والطبقةُ التي تمسك السلوكَ فعلًا هي
    // المُشغِّلُ في القاعدة: يرفض الحذفَ على أيّ حال. **فهذا يشتري الجملةَ
    // الأفضل، لا الأمان** — والأمانُ في `refuse_unlinking_stocked_folder`.
    //
    // ومُقالٌ هنا لأن النافذةَ **لا تُرسَم بفحصٍ ساكن**: مقيسٌ في هذه الجلسة —
    // `renderToStaticMarkup` يرجّع نصًّا فارغًا لأن الحوارَ يُبوَّب.
    expect(dialog).toContain('saveStorageCategories({')
  })

  it('never mentions the seeded column', () => {
    // 🔴 `seeded` افتراضُه `false`، و٠٦٦ب وحدَه كتب `true`. فكلُّ إدراجٍ من هذه
    // الشاشة يطلع قرارَ إنسانٍ **بلا أن تعرف الشاشةُ بالعمود** — وذكرُه هنا هو
    // بالضبط ما يعيد الفرقَ إلى الضياع.
    const io = fs.readFileSync(path.join(ROOT, 'lib', 'inventoryAdminIO.js'), 'utf8')
    const insert = io.slice(io.indexOf('export async function saveStorageCategories'))
    expect(insert.slice(0, insert.indexOf('export async function saveSupplier'))).not.toMatch(/seeded/)
  })

  it('is fed all the way down from the page', () => {
    // ⚠️ النصفُ الذي يفشل بصمت: منطقٌ سليمٌ يقرأ قوائمَ فارغة **يقول إن ما في
    // مجلّدٌ فيه رصيد** — أي يسمح بكلّ شيل. فالسلسلةُ تُفحص كاملة.
    expect(hook).toContain("from('storage_categories')")
    expect(hook).toContain('storageCategories')
    expect(page).toContain('storageCategories={directories.storageCategories}')
    expect(page).toContain('balances={balances.balances}')
    for (const prop of ['categories', 'products', 'balances', 'storageCategories']) {
      expect(manager).toContain(`${prop}={${prop}}`)
    }
  })
})
