/**
 * 🔴 **شكلُ شاشة الجرد — عمودان بنفس الاسم، ومعطَّلان بلا معالِج.**
 *
 * **الفحصُ الأوّلُ مكتوبٌ عن عطلٍ وقع فعلًا:** الشاشةُ المرجعيّةُ تسمّي عمودَين
 * `Price per unit` — أحدهما تكلفةٌ (٣٨) والآخرُ سعرُ بيع (٨٠). **فسقط أحدُهما
 * من عدّي وأنا أقرأ الترويسة**، وعلّقتُ وسومَ حالات التكلفة على خانة سعر
 * البيع: وسمٌ صادقٌ فوق رقمٍ لا يخصّه.
 *
 * ⚠️ **والاسمُ المكرَّرُ هو الآلة، لا السهو:** عمودٌ يحمل اسمَ جارِه يختفي في
 * العدّ **ولا يشتكي شيء.** ⇒ **فالتمايزُ يُحرَس لا يُتذكَّر.**
 *
 * **والفحصُ الثاني عن التعطيل:** «معطَّلٌ بالبنية» تعني **لا معالِجَ حدثٍ
 * إطلاقًا** — لا `<button disabled>` ولا `DropdownMenuItem disabled`. شرطٌ
 * يُنسى أو خاصّيّةٌ تُحذف تعيد عنصرًا معطَّلًا إلى الحياة، **ووسمٌ بلا معالِجٍ
 * لا يُنسى إليها.**
 */

const fs = require('fs')
const path = require('path')
const { stripComments: strip, eventHandlersIn } = require('./interactiveShapes')

const ROOT = path.join(__dirname, '..')
const SHEET = path.join(ROOT, 'components/StocktakingSheet.js')
const MENU = path.join(ROOT, 'components/StocktakeMethodMenu.js')
const LOCALE = path.join(ROOT, 'public/locales/ar/products.json')

const read = (file) => fs.readFileSync(file, 'utf8')

describe('شكلُ شاشة الجرد', () => {
  // ① 🔴 **لا عمودان بنفس الاسم** — وهو العطلُ الذي وقع.
  it('🔴 كلُّ عمودٍ اسمٌ متمايزٌ ومفتاحٌ متمايز — والمكرَّرُ يُسمّى', () => {
    const body = strip(read(SHEET))
    const head = body.slice(body.indexOf('<RefHead>'), body.indexOf('</RefHead>'))
    // ⚠️ **المشيةُ تُقاس قبل حكمها** — ترويسةٌ لا تُقرأ تمرّ خضراء.
    expect(`الترويسةُ مقروءة: ${head.length > 0}`).toBe('الترويسةُ مقروءة: true')

    const keys = [...head.matchAll(/stocktakePeriod\.(col[A-Za-z]+)/g)].map((m) => m[1])
    expect(`أعمدةٌ مقروءة ≥ 15: ${keys.length >= 15}`).toBe('أعمدةٌ مقروءة ≥ 15: true')

    const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(`مفاتيحُ مكرَّرة: ${[...new Set(dupKeys)].join(' · ') || 'لا شيء'}`)
      .toBe('مفاتيحُ مكرَّرة: لا شيء')

    const group = JSON.parse(read(LOCALE)).stocktakePeriod
    const labels = keys.map((k) => group[k])
    const missing = keys.filter((k) => !group[k])
    expect(`مفاتيحُ بلا نصّ: ${missing.join(' · ') || 'لا شيء'}`).toBe('مفاتيحُ بلا نصّ: لا شيء')

    const dupLabels = labels.filter((l, i) => labels.indexOf(l) !== i)
    expect(`نصوصٌ مكرَّرة: ${[...new Set(dupLabels)].join(' · ') || 'لا شيء'}`)
      .toBe('نصوصٌ مكرَّرة: لا شيء')
  })

  // ② 🔴 **كلُّ معطَّلٍ بلا معالِجٍ — والقائمةُ تُشتقّ ولا تُكتب.**
  //
  // ⚠️ **كان هنا فحصان يسمّيان معطَّلَين بأعينهما** (طريقا القائمة، ثمّ زرُّ
  // الحفظ)، **فجاء الرابعُ (تصدير إكسل) ولم يكن لأحدهما.** ⇒ **والتعدادُ
  // يفشل مفتوحًا**، وهو الدرسُ المسجَّلُ بأربع نسخٍ في `CLAUDE.md`.
  //
  // ⇒ **فالإبرةُ صارت شكلًا: كلُّ عنصرٍ يحمل `data-…-disabled`.** ومعطَّلٌ
  // خامسٌ يُضاف غدًا **يدخل الفحصَ يومَ يُكتب**، بلا سطرٍ هنا.
  const DISABLED = /<(\w+)([^>]*\bdata-[a-z-]*disabled\b[^>]*)>/g

  it('🔴 وكلُّ معطَّلٍ بلا معالِج حدثٍ — والقائمةُ مشتقّةٌ لا مكتوبة', () => {
    const found = []
    for (const file of [SHEET, MENU]) {
      const body = strip(read(file))
      for (const match of body.matchAll(DISABLED)) {
        const marker = (match[2].match(/data-[a-z-]*disabled/) || ['?'])[0]
        found.push({
          where: `${path.basename(file)} ⟵ ${marker}`,
          tag: match[1],
          handlers: eventHandlersIn(match[0]),
        })
      }
    }

    // ⚠️ **المدى يُقاس قبل الحكم** — مشيةٌ لا تجد معطَّلًا تمرّ خضراء.
    //
    // 🔴 **والعدُّ بالمواضع لا بالعناصر المرسومة، وهذا حدٌّ يُقال:**
    // `DisabledMethod` **مكوّنٌ يُرسم مرّتين** (باركود وإكسل) **من موضعٍ
    // واحدٍ في النصّ.** فمسحُ النصِّ يرى ثلاثةَ مواضعَ لأربعة معطَّلات —
    // **والوسمُ الواحدُ يحرس نسخَه كلَّها**، فالتغطيةُ كاملةٌ والعددُ أصغر.
    const markers = [...new Set(found.map((f) => f.where.split(' ⟵ ')[1]))].sort()
    expect(`مواضعُ معطَّلةٌ مقروءة: ${found.length}`).not.toBe('مواضعُ معطَّلةٌ مقروءة: 0')
    expect(`الوسومُ الموجودة: ${markers.join(' · ')}`)
      .toBe('الوسومُ الموجودة: data-export-disabled · data-method-disabled · data-save-disabled')

    const withHandlers = found.filter((f) => f.handlers.length > 0)
    expect(`بمعالِجات: ${withHandlers.map((f) => `${f.where} (${f.handlers.join(' ')})`).join(' · ') || 'لا شيء'}`)
      .toBe('بمعالِجات: لا شيء')

    // 🔴 **ولا وسمَ تفاعليٍّ أصليٍّ بينها** — `<button disabled>` خاصّيّةٌ
    // تُحذف، و`<span>` لا شيءَ فيه ليُحذف.
    const native = found.filter((f) => ['button', 'input', 'select', 'a'].includes(f.tag))
    expect(`وسومٌ تفاعليّة: ${native.map((f) => `${f.where} (<${f.tag}>)`).join(' · ') || 'لا شيء'}`)
      .toBe('وسومٌ تفاعليّة: لا شيء')
  })

  // ③ ✅ **واليدويُّ يعمل فعلًا** — وإلّا كانت القائمةُ أمواتًا كلَّها.
  it('✅ والطريقُ اليدويُّ موصولٌ — فالقائمةُ ليست ثلاثةَ أموات', () => {
    const body = strip(read(MENU))
    expect(`موصول: ${/data-method="manual"/.test(body) && /onClick=\{onManual\}/.test(body)}`)
      .toBe('موصول: true')
    // 🔴 **وليس `DropdownMenuItem disabled`** — عنصرٌ تفاعليٌّ بخاصّيّةٍ تمنعه.
    //
    // ⚠️ **والإبرةُ مثبَّتةٌ بـ`<` عمدًا، وبدونها أعطت إيجابيّةً كاذبة:** بلا
    // القوس التقطت **سطرَ الاستيراد** ثمّ مدّت `[^>]*` عبر أسطرٍ حتى بلغت
    // `data-method-disabled` — فأعلنت وجودَ ما لا وجودَ له. **نافذةٌ بلا حدٍّ
    // أعلى، وهو الصنفُ الذي كسر حارسَ الإلغاء من قبل**، ووقعتُ فيه في حارسٍ
    // كتبتُه لأمنع صنفًا آخر.
    expect(`عنصرُ قائمةٍ معطَّل: ${/<DropdownMenuItem[^>]*disabled/.test(body)}`)
      .toBe('عنصرُ قائمةٍ معطَّل: false')
  })

  // ══════════════════════════════════════════════════════════════════
  // 🔴 الشاشةُ الجديدةُ **لا تستطيع الترحيل** — فصلٌ يُفرَض لا يُوصَف
  // ══════════════════════════════════════════════════════════════════
  //
  // **حفظُ التقدّم والترحيلُ مساران مختلفان في الاسترداد لا في الحجم:**
  //
  // ```
  // saveCount / removeCount   صفٌّ في stocktake_counts — يُكتب فوقه ويُمحى
  // post_stocktake_session    مستندٌ + حركاتٌ دائمة + غرامةٌ محتملة (٠٥٦ج)
  // ```
  //
  // ⚠️ **والثاني لا يُستدرَك إلّا بعكس المستند** (ADR-051). ⇒ **فالوصلُ
  // الجديدُ يمسّ الأوّلَ وحدَه، وهذا يفرضه:** ذكرُ الترحيل في ملفّ الشاشة —
  // استيرادًا أو نداءً — **يُسقط الحزمةَ باسمه**، ولا ينتظر أن يقرأ أحدٌ
  // تعليقًا.
  const POSTING = [
    ['postStocktakeSession', /\bpostStocktakeSession\b/],
    ['stocktakePayload', /\bstocktakePayload\b/],
    ['post_stocktake', /\bpost_stocktake\w*\b/],
  ]

  it('🔴 ولا طريقَ للترحيل من الشاشة الجديدة — والاسمُ يُسمّى إن ظهر', () => {
    const body = strip(read(SHEET))
    const found = POSTING.filter(([, shape]) => shape.test(body)).map(([name]) => name)
    expect(`ذكرُ الترحيل: ${found.join(' · ') || 'لا شيء'}`).toBe('ذكرُ الترحيل: لا شيء')

    // ✅ **والمُنادي الوحيدُ يبقى وحيدًا** — وإلّا صار الفصلُ ادّعاءً.
    const callers = ['components/StocktakeScreen.js', 'components/StocktakingSheet.js']
      .filter((rel) => /\bpostStocktakeSession\b/.test(strip(read(path.join(ROOT, rel)))))
    expect(`مُنادو الترحيل: ${callers.join(' · ')}`)
      .toBe('مُنادو الترحيل: components/StocktakeScreen.js')
  })

  // ══════════════════════════════════════════════════════════════════
  // 🔴 والمعطَّلُ يشبه الفاعلَ الذي سيصيره — شكلًا واحدًا لا شكلين
  // ══════════════════════════════════════════════════════════════════
  //
  // «حفظ الجرد» معطَّلٌ اليوم و**سيُفعَّل** يوم تُستوفى شروطُ البوّابة الأربعة.
  // ⚠️ **فلو كان شكلُه اليوم صندوقًا رماديًّا وشكلُه غدًا زرَّ الفعل الأساسيّ،
  // قرأت الموظّفةُ التفعيلَ ميزةً جديدةً لا حالةً تبدّلت** — وبحثت عن الزرّ في
  // مكانٍ آخر.
  //
  // ⇒ **والأصنافُ تُقرأ من `REF_ACTION_CLASS` ولا تُنسخ**، فشكلان لفعلٍ واحدٍ
  // لا يتباعدان.
  it('🔴 وزرُّ الحفظ المعطَّلُ يقرأ شكلَ الفعل الأساسيّ، ولا ينسخه', () => {
    const body = strip(read(SHEET))
    const save = body.slice(body.indexOf('data-save-disabled'))
    const tag = save.slice(0, save.indexOf('>') + 1)

    expect(`يقرأ الصنفَ المشترك: ${/REF_ACTION_CLASS/.test(tag)}`)
      .toBe('يقرأ الصنفَ المشترك: true')
    expect(`ويقرأ نمطَه: ${/REF_ACTION_STYLE/.test(tag)}`).toBe('ويقرأ نمطَه: true')

    // 🔴 **والشفافيّةُ صريحةٌ لا موروثة:** الصنفُ المشترك يحملها بصيغة
    // `disabled:opacity-40`، **وهي متغيّرُ حالةٍ لا يعمل إلّا على وسمٍ تفاعليٍّ
    // معطَّل** — و`<span>` ليس كذلك. **فبدون كتابتها هنا يُرسم بكامل لونه
    // كأنه فعّال، والصنفُ موجودٌ في النصّ فيطمئنّ قارئُه.**
    expect(`شفافيّةٌ صريحة: ${/\bopacity-\d+/.test(tag)}`).toBe('شفافيّةٌ صريحة: true')

    // وما زال وسمًا لا زرًّا — فالخاصّيّةُ التي تُحذف غيرُ موجودةٍ أصلًا.
    //
    // ⚠️ **والاسمُ يُقرأ إلى الوراء من الوسم لا إلى الأمام:** أوّلُ محاولةٍ
    // قرأت أوّلَ `<` **بعد** `data-save-disabled` فأعطت `RefTag` — أي الابنَ
    // لا الأب. **والفحصُ كان سيمرّ لو صادف أن الابنَ اسمُه `span`.**
    const openAt = body.lastIndexOf('<', body.indexOf('data-save-disabled'))
    expect(`الوسم: ${/<(\w+)/.exec(body.slice(openAt))[1]}`).toBe('الوسم: span')

    // 🔴 **والسببُ الظاهرُ يبقى مقروءًا على الخلفيّة الجديدة.**
    //
    // `RefTag` يخبز `text-muted-foreground` — لونًا مضبوطًا لخلفيّةٍ فاتحة.
    // **وعلى أزرقِ الكروم بهت السببُ حتى كاد لا يُقرأ**، ومقيسٌ: المحسوبُ كان
    // `oklch(0.556 0 0)` وحبرُ الزرّ `oklch(0.985 0 0)`.
    //
    // ⚠️ **وهذا يُبطل الحجّةَ التي يقوم عليها التعطيلُ كلُّه** — «خيارٌ معطَّلٌ
    // بسببٍ ظاهرٍ غيابٌ مُعلَن»، **فسببٌ لا يُقرأ يعيده زرًّا لا يفعل شيئًا بلا
    // تفسير.**
    //
    // ⚠️ **والمعدِّلُ المهمّ لازمٌ ولا يكفي دونَه:** بلا `!` وصلت `text-current`
    // إلى الوسم **ولم تفز** — ترتيبُ الأصناف في السمة لا يقرّر الغلبة.
    const tagAt = body.indexOf('<RefTag', openAt)
    const tagOpen = body.slice(tagAt, body.indexOf('>', tagAt) + 1)
    expect(`الوسمُ يرث الحبر: ${/text-current!/.test(tagOpen)}`).toBe('الوسمُ يرث الحبر: true')
  })

  // ⑤ ✅ **والحارسُ يعضّ — على نصٍّ لا على شجرة العمل.**
  it('✅ ويعضّ: اسمٌ مكرَّرٌ يُلتقط، ومعالِجٌ محقونٌ يُسمّى', () => {
    const twins = ['سعر الوحدة', 'المنتج', 'سعر الوحدة']
    const dup = twins.filter((l, i) => twins.indexOf(l) !== i)
    expect(`مكرَّر: ${[...new Set(dup)].join(' · ')}`).toBe('مكرَّر: سعر الوحدة')

    expect(eventHandlersIn('<div data-method-disabled="excel" onClick={() => {}}>'))
      .toEqual(['onClick'])
    expect(eventHandlersIn('<div data-method-disabled="excel" title={help}>')).toEqual([])
  })
})
