const fs = require('fs')
const path = require('path')
import { cancellationState, visibleDocuments } from './stockDocumentList'

// حرّاسُ «الإلغاء» في قائمة المستندات.
//
// 🔴 **والإلغاءُ هنا هو العكسُ القائم، لا علامةٌ على السطر** — واقتراحُ العلامة
// وحدَها فيه ثغرةٌ قِيست: المستندُ المرحَّلُ حرّك المخزونَ فعلًا، **فوسمُه
// «ملغى» بلا حركةٍ مضادّة يترك الرصيدَ ناقصًا ويجعل الشاشةَ تكذب على السجلّ.**

const ORIGINAL = 'doc-a'
const REVERSAL = 'doc-b'
const LIVE = 'doc-c'

const docs = [
  { id: ORIGINAL, doc_type: 'write_off', reverses_document_id: null },
  { id: REVERSAL, doc_type: 'reversal', reverses_document_id: ORIGINAL },
  { id: LIVE, doc_type: 'supply', reverses_document_id: null },
]

const strip = (text) => text
  .split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

describe('🔴 الحالةُ مشتقّةٌ بالاتّجاهين', () => {
  it('الأصلُ يُقرأ ملغًى — والرابطُ ليس عليه بل على مَن يشير إليه', () => {
    expect(cancellationState(docs[0], docs)).toEqual({
      cancelled: true, kind: 'original', pairId: REVERSAL,
    })
  })

  it('والعاكسُ يُقرأ نصفًا ثانيًا لا عمليّةً مستقلّة', () => {
    expect(cancellationState(docs[1], docs)).toEqual({
      cancelled: true, kind: 'reversal', pairId: ORIGINAL,
    })
  })

  it('والحيُّ يبقى حيًّا', () => {
    expect(cancellationState(docs[2], docs)).toEqual({
      cancelled: false, kind: 'live', pairId: null,
    })
  })

  it('🔴 **واتّجاهٌ واحدٌ يُخفي نصفَ الزوج** — الأصلُ بلا عاكسِه يُقرأ حيًّا', () => {
    // ⚠️ **البيّنةُ المضادّةُ للاشتقاق نفسِه:** لو قُرئ `reverses_document_id`
    // وحدَه لكان الأصلُ «حيًّا» أبدًا — **وهو أخطرُ الاتّجاهين**، لأنه يُبقي
    // زرَّ الإلغاء مضيئًا على مستندٍ أُلغي.
    expect(cancellationState(docs[0], [docs[0]]).cancelled).toBe(false)
    expect(cancellationState(docs[0], docs).cancelled).toBe(true)
  })

  it('ولا ينهار على مجموعةٍ فارغةٍ أو مستندٍ معدوم', () => {
    expect(cancellationState(null, docs).kind).toBe('missing')
    expect(cancellationState(docs[2], null).cancelled).toBe(false)
  })
})

describe('🔴 الزوجُ يُخفى معًا أو يظهر معًا', () => {
  it('بالإخفاء ⟵ يبقى الحيُّ وحدَه', () => {
    expect(visibleDocuments(docs, docs, true).map((d) => d.id)).toEqual([LIVE])
  })

  it('بلا إخفاءٍ ⟵ الثلاثةُ كلُّها', () => {
    expect(visibleDocuments(docs, docs, false).map((d) => d.id)).toEqual([ORIGINAL, REVERSAL, LIVE])
  })

  it('🔴 **ولا نصفَ حدثٍ في أيّ حال** — الأصلُ والعاكسُ يتلازمان', () => {
    // ⚠️ **الاتّجاهان يكذبان بشكلين:** أصلٌ ظاهرٌ بلا عاكسه يبدو نافذًا،
    // **وعاكسٌ ظاهرٌ بلا أصله يبدو حركةً بلا سبب.**
    for (const hide of [true, false]) {
      const ids = visibleDocuments(docs, docs, hide).map((d) => d.id)
      expect(`hide=${hide} ⟵ ${ids.includes(ORIGINAL) === ids.includes(REVERSAL)}`)
        .toBe(`hide=${hide} ⟵ true`)
    }
  })

  it('⚠️ ويُجاب من المجموعة كلِّها لا من المعروض — عاكسٌ مرشَّحٌ خارجًا لا يُحيي أصلَه', () => {
    // الصفوفُ المعروضةُ فيها الأصلُ وحدَه (رشّح النوعُ العاكسَ خارجًا)،
    // **والمجموعةُ الكاملةُ ما زالت تعرف أنه أُلغي.**
    const shown = [docs[0], docs[2]]
    expect(visibleDocuments(shown, docs, true).map((d) => d.id)).toEqual([LIVE])
  })
})

describe('🔴 الشاشةُ ترسم القرارَ فعلًا — لا المكتبةُ وحدَها', () => {
  const screen = strip(read('components/StockDocumentsList.js'))

  it('تنادي الاشتقاقَ وتمرّر المجموعة الكاملة', () => {
    // 🔴 **والمجموعةُ الكاملةُ صارت `all` لا `documents` — والاسمُ تغيّر لأن
    // المعنى اتّسع، لا ليمرّ الحارس.**
    //
    // `documents` هي مستنداتُ المخزون وحدَها، **و`all` هي المستنداتُ
    // والطلبيّاتُ معًا** بعد دمج المصدرين. ⚠️ **فتمريرُ `documents` هنا صار
    // ادّعاءً ناقصًا** — والسؤالُ «هل أُلغي هذا؟» يُجاب من كلّ ما هو معروض.
    //
    // ⇒ **والشرطُ يمنع الرجوعَ إلى الأضيق صراحةً**، وإلّا مرّ التضييقُ يومًا
    // بحجّة أنه «كان هكذا».
    expect(screen).toMatch(/cancellationState\(doc, all\)/)
    expect(screen).toMatch(/visibleDocuments\(matched, all, hideCancelled\)/)
    expect(screen).toMatch(/reversalState\(doc, all\)/)
    expect(screen).not.toMatch(/cancellationState\(doc, documents\)/)

    // و`all` هي الدمجُ فعلًا لا اسمٌ آخرُ لنفس المصفوفة.
    expect(screen).toMatch(/const all = mergedRows\(\{ documents, orders, orderLines \}\)/)
  })

  it('🔴 وزرُّ الإلغاء **يُخفى لا يُعطَّل** — قرارُ المالك', () => {
    // ⚠️ **والفرقُ حقيقيّ:** معطَّلٌ يقول «ممكنٌ لكن ليس الآن» فيُجرَّب مرارًا،
    // **وغائبٌ يقول «ليس من هنا»** — وللأنواع الثلاثة مسارُ تصحيحٍ آخر.
    expect(screen).toMatch(/\{state\.canReverse && \(/)
    // ولا يبقى الشرطُ القديمُ الذي كان يعطّل.
    expect(screen).not.toMatch(/disabled=\{!state\.canReverse/)
  })

  it('🔴 والسببُ إلزاميٌّ ويصل القاعدةَ في `p_note`', () => {
    expect(screen).toMatch(/note: reason\.trim\(\)/)
    // ⚠️ على المقصوص لا الخام — مسافةٌ ليست سببًا.
    expect(screen).toMatch(/disabled=\{busy \|\| reason\.trim\(\) === ''\}/)
  })

  it('⚠️ ويُفرَّغ عند الفتح والإغلاق — سببٌ باقٍ يُرسَل على مستندٍ آخر', () => {
    expect(screen).toMatch(/function openConfirm\([\s\S]{0,120}setReason\(''\)/)
    expect(screen).toMatch(/function closeConfirm\([\s\S]{0,120}setReason\(''\)/)
  })

  it('🔴 والملغى مميَّزٌ بصريًّا ومعلَّمٌ للقراءة الآليّة', () => {
    expect(screen).toMatch(/data-cancelled=\{cancel\.cancelled \? cancel\.kind : undefined\}/)
    expect(screen).toMatch(/line-through/)
  })

  it('⚠️ والمدفوعُ يُفحَص غيابُه قبل `toLocaleString`', () => {
    // نفسُ الصنف المؤجَّل على أربع شاشاتٍ أخرى: Number(null) ⟵ «٠٫٠٠ ₪».
    //
    // 🔴 **وهذا الشرطُ أُعيد توجيهُه حين صارت البطاقةُ شبكة، ولم يُخفَّف.**
    // كان يطابق سطرًا بعينه (`if (paid === null) return null`) — وهو **موضعُ
    // الفحص لا الفحصُ نفسُه**، فانكسر بتحوّلِ الإرجاعِ المبكر إلى فرعٍ ثلاثيّ
    // في خليّة. **والادّعاءُ الذي يجب أن يصمد أضيق:** القيمةُ الخامُّ لا تصل
    // المنسِّقَ إلّا بعد أن تمرَّ بـ`numberOrNull`.
    expect(screen).toMatch(/const paid = numberOrNull\(doc\.paid_amount\)/)
    expect(screen).toMatch(/paid === null/)
    expect(screen).toMatch(/paid\.toLocaleString/)
    // ⚠️ **والبيّنةُ المضادّةُ هي العطلُ حرفيًّا:** `doc.paid_amount` ملاصقًا
    // لمنسِّقٍ يعني أن العمودَ الخامَّ يُنسَّق بلا فحص.
    expect(screen).not.toMatch(/paid_amount[\s\S]{0,60}toLocaleString/)
  })

  it('🔴 ووقتُ التسجيل من `created_at` لا من `doc_date`', () => {
    // ⚠️ **والخطأُ هنا لا يبدو خطأً:** `doc_date` منتصفُ ليلٍ دائمًا (كلُّ
    // شاشات الإدخال `<input type="date">`)، **فعمودٌ مبنيٌّ عليه يطبع «٠٠:٠٠»
    // على كلّ صفٍّ إلى الأبد** — رقمٌ سليمُ الشكل، متّسقٌ مع نفسه، وكاذب.
    expect(screen).toMatch(/documentTime\(doc\.created_at\)/)
    expect(screen).not.toMatch(/documentTime\(doc\.doc_date\)/)
  })

  it('🔴 وعددُ الترويسات هو `COLUMNS` نفسُه', () => {
    // ⚠️ **خطرٌ أحدثته الشبكة:** `RefFillerRow` يمتدّ بعددٍ مُعلَن، **ورقمان
    // متقابلان يتباعدان بصمت** — فتُرسم خانةٌ ناقصةٌ أو زائدةٌ ولا شيءَ يشتكي.
    const heads = (screen.match(/<RefTh>/g) || []).length
    const declared = Number((screen.match(/const COLUMNS = (\d+)/) || [])[1])
    expect(`ترويسات=${heads} · COLUMNS=${declared}`).toBe(`ترويسات=${declared} · COLUMNS=${declared}`)
    expect(screen).toMatch(/<RefFillerRow columns=\{COLUMNS\} \/>/)

    // 🔴 **وشرطُ `colSpan={COLUMNS}` سقط، ولم يُخفَّف — قارئُه اختفى.**
    // كان صفُّ التفصيل يمتدّ على الجدول كلِّه، **وصار التفصيلُ لوحًا فوق
    // الشاشة** فلا صفَّ كاملَ العرض في الجدول إطلاقًا. **وإبقاءُ الشرط كان
    // سيطالب برسمٍ لا يجب أن يوجد.**
    expect(screen).not.toMatch(/colSpan=\{COLUMNS\}/)
  })

  it('🔴 و«من» و«إلى» متجاورتان — لأن خليّةَ الجرد تمتدّ عليهما بالعدد', () => {
    // ⚠️ **قرانٌ حسابيٌّ جديدٌ أحدثه الفصل:** الجردُ يحمل الاتّجاهين في مستندٍ
    // واحد فيمتدّ بـ`colSpan={2}` — **وذلك صحيحٌ فقط ما دام العمودان
    // متلاصقين.** فإعادةُ ترتيبٍ تُقحم «ملاحظة» بينهما تجعل خليّةَ الجرد
    // تغطّي عمودًا لا تعنيه، **ولا شيءَ يشتكي: الجدولُ يبقى سليمَ البنية.**
    const order = [...screen.matchAll(/t\('products:documents\.(col[A-Za-z]+)'\)/g)].map((m) => m[1])
    const from = order.indexOf('colFrom')
    expect(`موضع colFrom = ${from >= 0}`).toBe('موضع colFrom = true')
    expect(`بعد colFrom ⟵ ${order[from + 1]}`).toBe('بعد colFrom ⟵ colTo')
    expect(screen).toMatch(/colSpan=\{2\}/)
  })

  it('🔴 والمَخرجُ مُسمًّى، ومربوطٌ بمقبض الصفحة لا بتاريخ المتصفّح', () => {
    // ⚠️ **`×` في شريط `RefModal` كان موجودًا ولم يُقرأ مَخرجًا** — فالزرُّ
    // بكلمةٍ لا يلغيه بل يسمّيه، **وأثرُهما واحد: `closeOperation`.**
    // 🔴 **و`router.back()` ممنوعٌ هنا بقياس:** العمليّةُ محمولةٌ في `?op=`،
    // **ودخولٌ مباشرٌ أو تحديثٌ لا يتركان تاريخًا يُرجَع إليه.**
    expect(screen).toMatch(/data-documents-back/)
    expect(screen).toMatch(/onClick=\{onClose\}/)
    expect(screen).not.toMatch(/router\.back|history\.back/)

    // والصفحةُ تمرّره فعلًا — وإلّا كان الزرُّ مرسومًا بلا أثر.
    const page = strip(read('pages/products/index.js'))
    expect(page).toMatch(/<StockDocumentsList[\s\S]{0,900}onClose=\{closeOperation\}/)
  })

  it('🔴 ولوحُ المشاهدة للقراءة فقط، ولا حوارٌ داخل حوار', () => {
    // ⚠️ **الصفحةُ تلفّ كلَّ عمليّةٍ بـ`RefModal` واحدة**، **وتعشيشُ حوارٍ في
    // حوارٍ كلّف جولةً كاملةً في هذا المشروع** (ترويسة `InvoicePickerDialog`).
    // فاللوحُ مطلقُ الموضع، **ومصيدةُ البؤرة تبقى واحدة.**
    expect(screen).toMatch(/data-document-view=\{viewed\.id\}/)
    expect(screen).toMatch(/absolute inset-0/)
    expect(screen).not.toMatch(/<RefModal/)

    // 🔴 **وصفرُ حقولِ إدخالٍ داخل اللوح** — تعديلُ مستندٍ مرحَّلٍ محرَّمٌ
    // بـADR-051، **فهذا امتدادُ الحدّ لا شكلُه.**
    //
    // ⚠️ **وأوّلُ صياغةٍ لهذا الشرط عضّت كودًا سليمًا:** القطعُ كان من اللوح
    // **إلى آخر الملفّ**، فالتقط حقلَ سببِ الإلغاء في نافذة التأكيد أسفلَه.
    // **مداه كان أوسعَ من جملته** — نفسُ صنف حارس المال حين مشى غيرَ عوديٍّ،
    // بالاتّجاه المعاكس. ⇒ **الحدّان معًا، والحدُّ الأعلى مثبَّتٌ باسمه.**
    const start = screen.indexOf('data-document-view')
    const end = screen.indexOf('<Dialog open=')
    expect(`اللوحُ قبل نافذة التأكيد = ${start > 0 && end > start}`)
      .toBe('اللوحُ قبل نافذة التأكيد = true')
    const panel = screen.slice(start, end)
    expect(panel).not.toMatch(/<input|<select|<textarea|contentEditable/)

    // 🔴 **واللوحُ يفرّق بين المصدرين، وإلّا كذب.**
    // كان يقرأ `movementsOf` للصفَّين معًا — **والطلبيّةُ بلا حركاتٍ إطلاقًا**،
    // فرُسمت «المستند بلا سطور» على طلبيّةٍ لها سطور. ⚠️ **جملةٌ خاطئةٌ تُعرض
    // على إنسان، لا ميزةٌ غائبة** — وهي عائلةُ «فراغٌ مشروعُ الشكلِ مكانَ
    // الحقيقة» نفسُها.
    expect(panel).toMatch(/rowIsOrder\(viewed\) \?/)

    // 🔴 **والادّعاءُ انتقل مع الكود، ولم يُخفَّف.** كان اللوحُ يقرأ سطورَ
    // الطلبيّة بنفسه؛ **وصار يفوّض `OrderDocumentView`** ويفوّض الشطبَ
    // لشاشته. ⇒ **فيُحرَس التفويضُ هنا، والمصدرُ حيث صار.**
    expect(panel).toMatch(/<OrderDocumentView/)
    expect(panel).toMatch(/viewed\.doc_type === 'write_off'[\s\S]{0,120}<WriteOffDocumentView/)

    // والشاشةُ المفوَّضُ إليها تقرأ المصدرَ الصحيح — وإلّا عاد اللوحُ يكذب.
    const view = strip(read('components/documentView/OrderDocumentView.js'))
    expect(view).toMatch(/orderViewLines\(orderLines, order\.id\)/)
    expect(view).not.toMatch(/movementsOf/)
    // وشاهدُ صدقٍ: القطعةُ ليست فارغةً ولا تكاد.
    expect(`طولُ اللوح > 400 ⟵ ${panel.length > 400}`).toBe('طولُ اللوح > 400 ⟵ true')
  })

  it('🔴 والقيمةُ تحمل كلمةَ نوعِها داخلَ الخليّة، والترويسةُ محايدة', () => {
    // ⚠️ **الرقمُ متطابقُ الشكل في كلّ الأنواع** (`documentValue` تُرجع الجانبَ
    // الأثقل)، **فالكلمةُ وحدَها تمنع صفرَ النقل وصفرَ التوريد المسموم من أن
    // يُقرآ الشيءَ نفسَه.** وترويسةُ عمودٍ كلمةٌ واحدةٌ لكلّ الصفوف، **فنقلُ
    // الكلمةِ إليها كان سيقتل التمييز.**
    expect(screen).toMatch(/documentValueLabel\(doc\.doc_type\)/)
    expect(screen).toMatch(/documents\.colValue/)
  })

  it('⚠️ وأيقونتا الإجراءات تحملان اسمًا مقروءًا لمن لا يراهما', () => {
    // زرٌّ بأيقونةٍ وحدَها بلا اسمٍ هو زرٌّ بلا اسم — **والنصُّ كان ظاهرًا
    // («عكس») قبل الشبكة، فهذه خسارةٌ أحدثها الشكلُ الجديد لا نقصٌ قديم.**
    for (const key of ['viewButton', 'reverseButton']) {
      expect(screen).toMatch(new RegExp(`aria-label=\\{t\\('products:documents\\.${key}'\\)\\}`))
      expect(screen).toMatch(new RegExp(`title=\\{t\\('products:documents\\.${key}'\\)\\}`))
    }
  })

  it('⚠️ والخانةُ ليست مرشِّحًا — فلا يعيدها «امسح المرشِّحات»', () => {
    const filters = strip(read('lib/documentFilters.js'))
    expect(filters).not.toMatch(/hideCancelled/)
    expect(screen).toMatch(/useState\(true\)/)
  })

  it('🔴 وكلُّ مفتاحٍ يطلبه الصفُّ له جملةٌ — والقائمةُ مشتقّةٌ لا مكتوبةٌ بيد', () => {
    // 🔴 **كانت سبعةَ أسماءٍ مكتوبةً بيد، ومنها اسمان فقدا قارئَهما بالشبكة**
    // (`numberLabel` و`paidBadge`: ترويسةُ العمود صارت تحمل الكلمةَ فصار
    // تكرارُها في الخليّة ضجيجًا). **وشطبُ اسمين من قائمةٍ لتمرّ إعادةُ تنظيمٍ
    // هو بالضبط تخفيفُ حارس** — فاستُبدلت القائمةُ بالاشتقاق.
    //
    // ⚠️ **والفرقُ ليس أناقة:** القائمةُ اليدويّةُ **تفشل مفتوحةً** — تجد ما
    // وُضع فيها وتسكت عن كلّ ما عداه بنبرة النجاح، **فمفتاحٌ يُضاف غدًا لا
    // يدخلها.** والاشتقاقُ يراه يومَ يُكتب.
    const ar = JSON.parse(read('public/locales/ar/products.json'))
    const asked = [...new Set(
      [...screen.matchAll(/t\('products:documents\.([A-Za-z0-9_]+)'/g)].map((m) => m[1])
    )]

    // ⚠️ **حدٌّ أدنى، فمشيةٌ لا تلقى شيئًا لا تمرّ صامتة** — وهو الشكلُ الذي
    // اتّخذه كلُّ فحصٍ أجوفَ في هذا المشروع حتى الآن.
    expect(asked.length).toBeGreaterThan(15)

    for (const key of asked) {
      expect(`documents.${key} = ${typeof ar.documents[key]}`)
        .toBe(`documents.${key} = string`)
    }
  })
})
