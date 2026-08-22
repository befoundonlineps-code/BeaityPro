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

  // ② 🔴 **المعطَّلاتُ بلا معالِجٍ إطلاقًا.**
  it('🔴 وطريقا الباركود والإكسل بلا معالِج حدثٍ — والموجودُ يُسمّى', () => {
    const body = strip(read(MENU))
    const block = body.slice(body.indexOf('function DisabledMethod'), body.indexOf('export default'))
    expect(`الكتلةُ مقروءة: ${block.length > 0}`).toBe('الكتلةُ مقروءة: true')

    expect(`معالِجاتٌ في المعطَّل: ${eventHandlersIn(block).join(' · ') || 'لا شيء'}`)
      .toBe('معالِجاتٌ في المعطَّل: لا شيء')
    expect(`onSelect: ${/onSelect/.test(block)}`).toBe('onSelect: false')
    // 🔴 **وليس `DropdownMenuItem` معطَّلًا** — عنصرٌ تفاعليٌّ بخاصّيّةٍ تمنعه.
    expect(`عنصرُ قائمةٍ معطَّل: ${/DropdownMenuItem[^>]*disabled/.test(block)}`)
      .toBe('عنصرُ قائمةٍ معطَّل: false')

    // ✅ **واليدويُّ يعمل فعلًا** — وإلّا كانت القائمةُ ثلاثةَ أمواتٍ لا واحدًا حيًّا.
    expect(`اليدويُّ موصول: ${/data-method="manual"/.test(body) && /onClick=\{onManual\}/.test(body)}`)
      .toBe('اليدويُّ موصول: true')
  })

  // ③ 🔴 **وزرُّ الحفظ كذلك.**
  it('🔴 و«حفظ الجرد» بلا معالِجٍ إطلاقًا', () => {
    const body = strip(read(SHEET))
    const open = body.indexOf('data-save-disabled')
    expect(`الوسمُ موجود: ${open > -1}`).toBe('الوسمُ موجود: true')
    // ⚠️ **الحدُّ الأعلى مثبَّتٌ باسمه لا بعددِ حروف** — نافذةٌ ثابتةُ العرض
    // هي ما كسر حارسَ الإلغاء يومَ أُضيفت خاصّيّة.
    const block = body.slice(body.lastIndexOf('<span', open), body.indexOf('</span>', open))
    expect(`معالِجاتٌ في زرّ الحفظ: ${eventHandlersIn(block).join(' · ') || 'لا شيء'}`)
      .toBe('معالِجاتٌ في زرّ الحفظ: لا شيء')
    expect(`<button: ${/<button/.test(block)}`).toBe('<button: false')
  })

  // ④ ✅ **والحارسُ يعضّ — على نصٍّ لا على شجرة العمل.**
  it('✅ ويعضّ: اسمٌ مكرَّرٌ يُلتقط، ومعالِجٌ محقونٌ يُسمّى', () => {
    const twins = ['سعر الوحدة', 'المنتج', 'سعر الوحدة']
    const dup = twins.filter((l, i) => twins.indexOf(l) !== i)
    expect(`مكرَّر: ${[...new Set(dup)].join(' · ')}`).toBe('مكرَّر: سعر الوحدة')

    expect(eventHandlersIn('<div data-method-disabled="excel" onClick={() => {}}>'))
      .toEqual(['onClick'])
    expect(eventHandlersIn('<div data-method-disabled="excel" title={help}>')).toEqual([])
  })
})
