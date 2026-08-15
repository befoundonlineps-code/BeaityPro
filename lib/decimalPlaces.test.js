import { roundTyped, decimalsIn, PLACES } from './decimalPlaces'

// 🔴 التقريبُ معلَنٌ لا صامت — قرارُ المالك — **والتنفيذُ يخطئ بصمتٍ بطريقتين
// مألوفتين، كلتاهما لصالح الأصغر.**

describe('the two familiar ways to round are both wrong, in the same direction', () => {
  // ⚠️ **بيّنةٌ مضادّةٌ داخل الاختبار لا حقنٌ في الشيفرة** — الطريقتان
  // المرفوضتان مكتوبتان هنا ليُرى خطؤهما، فلا يعود أحدٌ يقترحهما «تبسيطًا».
  const byMultiply = (n) => Math.round(n * 100) / 100
  const byToFixed = (n) => Number(n.toFixed(2))

  // ⚠️ **الجدولُ مقيسٌ على هذا المحرّك، وأوّلُ صياغةٍ له سمّت الأرقامَ الخطأ:**
  // قالت إن `10.005` تنكسر بالضرب، **وهي تعمل.** الذي ينكسر `1.005` و`1.015`.
  // والذاكرةُ لا تعرف أيَّهما — والقياسُ وحدَه يعرف.
  const MEASURED = [
    { typed: '1.005', multiply: 1, toFixed: 1, correct: '1.01' },
    { typed: '1.015', multiply: 1.01, toFixed: 1.01, correct: '1.02' },
    { typed: '2.675', multiply: 2.68, toFixed: 2.67, correct: '2.68' },
    { typed: '0.615', multiply: 0.62, toFixed: 0.61, correct: '0.62' },
    { typed: '10.005', multiply: 10.01, toFixed: 10.01, correct: '10.01' },
  ]

  it('gets every measured case right where the two familiar ways do not', () => {
    for (const c of MEASURED) {
      expect(`${c.typed} ⟶ ${roundTyped(c.typed).text}`).toBe(`${c.typed} ⟶ ${c.correct}`)
    }
  })

  it('and the two familiar ways are wrong on four of the five — always downwards', () => {
    // 🔴 الاتّجاهُ هو الخطر: خطأٌ نحو الأصغر لا يشتكي منه أحدٌ حتى يُجمَع
    // ألفَ مرّة. ولو كان الخطأُ عشوائيَّ الاتّجاه لانكشف بأوّل مطابقةِ فاتورة.
    for (const c of MEASURED) {
      expect(`${c.typed} × 100 ⟶ ${byMultiply(Number(c.typed))}`).toBe(`${c.typed} × 100 ⟶ ${c.multiply}`)
      expect(`${c.typed} toFixed ⟶ ${byToFixed(Number(c.typed))}`).toBe(`${c.typed} toFixed ⟶ ${c.toFixed}`)
      expect(Number(c.correct)).toBeGreaterThanOrEqual(c.multiply)
      expect(Number(c.correct)).toBeGreaterThanOrEqual(c.toFixed)
    }
  })

  it('rounds a price DOWN when the digit says so — it is not «always up»', () => {
    // ⚠️ حارسٌ على الاتّجاه المعاكس: تنفيذٌ يزيد دائمًا يمرّ من كلّ ما فوقه.
    expect(roundTyped('10.004').text).toBe('10')
    expect(roundTyped('2.674').text).toBe('2.67')
  })
})

describe('what was typed decides, not what it equals', () => {
  it('counts the decimals in the TEXT', () => {
    // `Number('10.50')` يساوي `10.5`، فالعدُّ على الرقم يقول واحدةً عن نصٍّ فيه
    // اثنتان — ولا شيء يُقرَّب، فلا رسالةَ تظهر عن تغييرٍ لم يقع.
    expect(decimalsIn('10.50')).toBe(2)
    expect(decimalsIn('10')).toBe(0)
    expect(decimalsIn('10.')).toBe(0)
    expect(roundTyped('10.50').rounded).toBe(false)
    expect(roundTyped('10.50').text).toBe('10.50')
  })

  it('leaves two decimals exactly alone, character for character', () => {
    // ⚠️ لا يُعاد بناءُ النصّ لما لا يحتاج تقريبًا: `String(Number('10.50'))`
    // يعطي `'10.5'` — تغييرٌ في الحقل بلا سببٍ ولا رسالة.
    for (const text of ['0', '10', '10.5', '10.50', '0.01', '', '  ']) {
      expect(roundTyped(text).rounded).toBe(false)
    }
    expect(roundTyped('0.01').text).toBe('0.01')
  })
})

describe('the empty field stays empty', () => {
  it('never becomes zero', () => {
    // 🔴 هذا المشروع دفع ثمنَ `Number('') === 0` مرّتين: خانةٌ فارغة وصلت `0`
    // واجتازت `v_cost >= 0`، فصار «لا أعرف» رقمًا.
    expect(roundTyped('')).toEqual({ text: '', rounded: false, from: '' })
    expect(roundTyped(null).text).toBe('')
    expect(roundTyped(undefined).text).toBe('')
  })

  it('leaves something that is not a number alone rather than zeroing it', () => {
    expect(roundTyped('abc').text).toBe('abc')
    expect(roundTyped('abc').rounded).toBe(false)
  })
})

describe('the answer carries what it needs to be said out loud', () => {
  it('names the value it came from, so the sentence can show both', () => {
    // «قُرِّب من ١٠.٠٠٥ إلى ١٠.٠١» — والرسالةُ بلا القيمة الأصليّة تقول إن شيئًا
    // تغيّر بلا أن تقول من ماذا، فيبقى القارئُ لا يعرف ما فقده.
    const answer = roundTyped('10.005')
    expect(answer).toEqual({ text: '10.01', rounded: true, from: '10.005' })
  })

  it('says «not rounded» when the rounding changed nothing', () => {
    // ⚠️ `10.001` → `10` — تغيّرت. بينما `10.000` → `10` وهي نفسُ الرقم، فلا
    // رسالة: **إعلانُ تغييرٍ لم يقع يعلّم القارئَ تجاهلَ الرسالة.**
    expect(roundTyped('10.001').rounded).toBe(true)
    expect(roundTyped('10.000').rounded).toBe(false)
  })

  it('uses two places, from one place', () => {
    expect(PLACES).toBe(2)
    // نصفٌ لأعلى: الرقمُ الرابع `5` فيرتفع الثالث.
    expect(roundTyped('1.2345', 3).text).toBe('1.235')
  })
})
