/**
 * 🔴 **٣.١٣ب — القفزةُ فوق المسجَّل.** المواصفة:
 * `design/stocktake-anomaly-resistance.md`، والبوّابة: الشرط ②.
 *
 * **والمقيسُ هنا ثلاثةٌ، والثالثُ هو الذي يُنسى:**
 *   ① القاعدةُ تومض عند كلّ حادثةٍ مقيسة، **وتصمت عند كلّ حالةٍ مشروعة.**
 *   ② وحافّتاها مثبَّتتان — `ANOMALY_RATIO` و`ANOMALY_FLOOR` كلتاهما، من الجانبين.
 *   ③ **والورقةُ لا ترسمها قبل مغادرة الخانة** — وهو الفرقُ الوحيدُ عن تنبيه
 *     «القطع ما بتتجزّأ»، **فلو ضاع صار التنبيهُ يومض على بادئات الأرقام.**
 *
 * ⚠️ **وما لا يُقاس هنا يُقال:** `renderToStaticMarkup` لا تُحدث حدثًا، فالنصفُ
 * الموجب («بعد المغادرة يظهر») **غيرُ قابلٍ للقياس في Jest بهذه العدّة** — لا
 * jsdom ولا testing-library في المشروع. **مقيسٌ بمحرّكٍ حقيقيٍّ عبر CDP، ومكتوبٌ
 * في رسالة الـPR.** والمقيسُ هنا هو النصفُ السالب، **وهو الذي يحرس النمط.**
 */

const fs = require('fs')
const path = require('path')
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')

jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key) }),
}))

const ROOT = path.join(__dirname, '..')
const {
  ANOMALY_RATIO, ANOMALY_FLOOR, jumpsAboveRecord, dropsBelowRecord, settledCount,
} = require('./stocktakeSheet')
const StocktakingSheet = require('../components/StocktakingSheet').default

const CARTON = {
  id: 'p1', name: 'مبرد ومهدئ ليزر', base_unit: 'pcs', units_per_package: 15, category_id: 'c1', is_active: true,
}

describe('① جدولُ المقابلة — بالاتّجاهين، صفًّا صفًّا', () => {
  // ⚠️ **الصفُّ الواحدُ لا يكفي، والاتّجاهُ هو كلُّ شيء:** حارسٌ يومض دائمًا
  // ينجح في نصفِ هذه الحالات، **وحارسٌ يصمت دائمًا ينجح في النصف الآخر.**
  const CASES = [
    // المسجَّل · المعدود · يومض؟ · لماذا يهمّ هذا الصفّ
    [150, 1950, true, 'الحادثةُ الأصليّة — الجردةُ الأولى'],
    [1950, 28650, true, 'الجردةُ الثانية بعد تسعٍ وثلاثين ثانية'],
    [5, 50, true, 'نمطُ «تجريبي» بالمستودع العامّ — وهو حدُّ K بالضبط'],
    [50, 100, false, '🔴 حدُّ المواصفة: ضِعفٌ لا يُميَّز بمقدارِه عن نموٍّ مشروع'],
    [0, 200, false, 'أوّلُ جردٍ في صالونٍ حقيقيّ — لا شيءَ مسجَّل'],
    [40, 0, false, 'رفٌّ أُفرِغ بمشروعيّة — والصفرُ أهمُّ عدّ'],
    [40, 12, false, 'عجزٌ حقيقيّ — وهو غرضُ الموديول لا عطلُه'],
    [1, 12, false, 'أرقامٌ صغيرة: نسبتُها اثنتا عشرةَ وفرقُها أحدَ عشر'],
    [3, 75, true, 'الكرتونةُ خلف الباب — إيجابٌ كاذبٌ مقبولٌ عمدًا عند المغادرة'],
  ]

  it.each(CASES)('مسجَّل %s ⟵ معدود %s ⟶ يومض: %s (%s)', (recorded, counted, fires) => {
    expect(`${recorded}⟵${counted} ⟶ ${jumpsAboveRecord(counted, recorded)}`)
      .toBe(`${recorded}⟵${counted} ⟶ ${fires}`)
  })
})

describe('①ب والاتّجاهُ الهابط — جدولُ مقابلةٍ مستقلّ', () => {
  // 🔴 **قرارُ المالك: ٣.١٣ب صار ثنائيَّ الاتّجاه.** والجدولُ مستقلٌّ لا
  // منعكسٌ آليًّا عن الأوّل، **لأنّ صفَّين فيه يقولان عكسَ ما يقوله نظيراهما
  // فوق** — وهما بالضبط ثمنُ القرار المُعلَن.
  const DROPS = [
    // المسجَّل · المعدود · يومض؟ · لماذا يهمّ هذا الصفّ
    [50, 5, true, '🔴 الحادثةُ التي وُجد لها: خانةٌ ناقصةٌ ⟶ عجزٌ وهميٌّ ٤٥'],
    [1950, 150, true, 'الحادثةُ الأصليّةُ مقلوبةً — نفسُ الرقمين'],
    [100, 50, false, '🔴 النصفُ لا يُميَّز بمقدارِه عن استهلاكٍ مشروع'],
    [0, 200, false, 'لا شيءَ مسجَّل — وكلُّ نسبةٍ إلى صفرٍ لا معنى لها'],
    [12, 1, false, 'أرقامٌ صغيرة: الفرقُ أحدَ عشرَ، دون الأرضيّة'],
    [200, 0, true, '⚠️ رفٌّ أُفرِغ بمشروعيّة — **يومض، وذلك ثمنٌ مقبولٌ مُعلَن**'],
    [40, 12, false, 'عجزٌ حقيقيٌّ متوسّط — نسبتُه دون العشرة فيصمت'],
    [1950, 28650, false, 'الصعودُ ليس شأنَ هذه الدالّة'],
  ]

  it.each(DROPS)('مسجَّل %s ⟵ معدود %s ⟶ يومض: %s (%s)', (recorded, counted, fires) => {
    expect(`${recorded}⟵${counted} ⟶ ${dropsBelowRecord(counted, recorded)}`)
      .toBe(`${recorded}⟵${counted} ⟶ ${fires}`)
  })

  // 🔴 **والصفّان اللذان ينقضان نظيرَيهما فوق، مُفردَين كي لا يُقرآ سهوًا:**
  it('🔴 صفرٌ معدودٌ يومض هنا ويصمت فوق — وذاك ثمنُ القرار لا سهوُه', () => {
    // فوق: «رفٌّ أُفرِغ بمشروعيّة — والصفرُ أهمُّ عدّ» ⟶ صامت.
    // وهنا يومض، **لأنّ الحارسَ لا يفرّق بين خانةٍ ناقصةٍ وعجزٍ حقيقيّ** —
    // ولم يُطلب منه أن يفرّق. ⇒ **من يقرأ الصمتَ فوق ويتوقّعه هنا يجد عكسَه،
    // فيُكتب الصفّان متجاورَين.**
    expect(jumpsAboveRecord(0, 200)).toBe(false)
    expect(dropsBelowRecord(0, 200)).toBe(true)
  })

  it('🔴 والدالّتان لا تصدقان معًا أبدًا — الشرطان يتنافيان', () => {
    // فالسطران في الورقة لا يتزاحمان، ولو بُنيا متجاورَين.
    for (const [r, c] of [[150, 1950], [50, 5], [100, 100], [0, 0], [40, 12], [200, 0]]) {
      expect(jumpsAboveRecord(c, r) && dropsBelowRecord(c, r)).toBe(false)
    }
  })

  it('🔴 والحافّتان هما نفسُهما مقلوبتَين، لا رقمان ثانيان', () => {
    // نسبةُ عشرةٍ بالضبط تومض، وما دونها بشعرةٍ يصمت — والفرقُ بعيدٌ عن
    // الأرضيّة في الزوجين فلا يقرّر شيئًا.
    expect(`50⟵5 ⟶ ${dropsBelowRecord(5, 50)}`).toBe('50⟵5 ⟶ true')
    expect(`49⟵5 ⟶ ${dropsBelowRecord(5, 49)}`).toBe('49⟵5 ⟶ false')
    // وفرقُ عشرين بالضبط يومض، وتسعةَ عشرَ يصمت — والنسبةُ تتجاوز العشرةَ
    // في الزوجين فلا تقرّر شيئًا.
    expect(`22⟵2 ⟶ ${dropsBelowRecord(2, 22)}`).toBe('22⟵2 ⟶ true')
    expect(`21⟵2 ⟶ ${dropsBelowRecord(2, 21)}`).toBe('21⟵2 ⟶ false')
    // ومن الثابتين لا من رقمٍ منسوخ.
    expect(dropsBelowRecord(3, ANOMALY_RATIO * 3)).toBe(true)
    expect(dropsBelowRecord(1, ANOMALY_FLOOR + 1)).toBe(true)
  })

  it('✅ وما ليس عددًا لا يومض ولا ينفجر', () => {
    expect(dropsBelowRecord(null, 150)).toBe(false)
    expect(dropsBelowRecord(5, null)).toBe(false)
    expect(dropsBelowRecord('قليل', 150)).toBe(false)
    expect(dropsBelowRecord(undefined, undefined)).toBe(false)
  })

  it('🔴 و«فارغ» ليس «صفرًا معدودًا» — والاتّجاهُ الهابطُ هو ما كشفها', () => {
    // `Number(null) === 0` وهو منتهٍ، فالشرطُ القديم كان يمرّره. ولم يظهر
    // ما دام الاتّجاهُ صعوديًّا وحدَه، لأن `counted <= recorded` يُسقط الصفرَ
    // قبل أيّ حكم — **فنجا بالمصادفة لا بالحراسة.**
    //
    // ⇒ والفرقُ عمليّ: عدٌّ لم يُكتب يُقرأ «رفًّا أُفرِغ» فيومض تنبيهٌ على
    // صفٍّ لم يلمسه أحد، وورقةُ جردٍ تومض على ما لم يُعدّ تعلّم التجاهل.
    for (const empty of [null, undefined, '', '   ']) {
      expect(dropsBelowRecord(empty, 150)).toBe(false)
      expect(jumpsAboveRecord(empty, 150)).toBe(false)
    }
    // 🔴 والصفرُ المكتوبُ صراحةً يبقى عدًّا حقيقيًّا، وهو التمييزُ كلُّه.
    expect(dropsBelowRecord(0, 150)).toBe(true)
    expect(dropsBelowRecord('0', 150)).toBe(true)
  })

  it('🔴 والصفرُ المكتوبُ لا يومض دائمًا — الأرضيّةُ تحرسه', () => {
    // ⚠️ سُئل: «أيومض الصفرُ دائمًا مقابلَ مسجَّلٍ موجب؟» ورُجّح «نعم»،
    // **والمقيسُ لا** — فرفٌّ صغيرٌ أُفرِغ لا يُزعج، وكبيرٌ يُسأل عنه.
    // وذلك أثرُ `ANOMALY_FLOOR` وحدَها، لا شرطٌ ثانٍ يُضاف.
    expect([5, 15, 19].map((r) => dropsBelowRecord(0, r))).toEqual([false, false, false])
    expect([20, 21, 150].map((r) => dropsBelowRecord(0, r))).toEqual([true, true, true])
    // والحدُّ من الثابت لا من رقمٍ منسوخ.
    expect(dropsBelowRecord(0, ANOMALY_FLOOR)).toBe(true)
    expect(dropsBelowRecord(0, ANOMALY_FLOOR - 1)).toBe(false)
  })
})

describe('② الحافّتان — كلٌّ من جانبيها، وواحدةٌ تقرّر في كلّ زوج', () => {
  // 🔴 **حدُّ K، والفرقُ بعيدٌ عن الأرضيّة في الحالتين فلا يقرّر شيئًا.**
  it('🔴 نسبةُ عشرةٍ بالضبط تومض، وما دونها بشعرةٍ يصمت', () => {
    expect(`5⟵50 (نسبة ${50 / 5}) ⟶ ${jumpsAboveRecord(50, 5)}`).toBe('5⟵50 (نسبة 10) ⟶ true')
    expect(`5⟵49 (نسبة ${49 / 5}) ⟶ ${jumpsAboveRecord(49, 5)}`).toBe('5⟵49 (نسبة 9.8) ⟶ false')
  })

  // 🔴 **وحدُّ F، والنسبةُ تتجاوز العشرةَ في الحالتين فلا تقرّر شيئًا** —
  // **فالساقطُ هنا هو الأرضيّةُ وحدَها، وهذا هو الغرض.**
  //
  // ⚠️ **وسألها المراجع: حافّةُ K مثبَّتةٌ وحافّةُ F ليست** — وكان محقًّا، وكلُّ
  // صفوف الجدول أعلاه إمّا بعيدةٌ عن العشرين (١١) أو فوقها بكثير (٤٥ فأكثر).
  it('🔴 فرقُ عشرين بالضبط يومض، وتسعةَ عشرَ يصمت', () => {
    expect(`2⟵22 (فرق ${22 - 2}) ⟶ ${jumpsAboveRecord(22, 2)}`).toBe('2⟵22 (فرق 20) ⟶ true')
    expect(`2⟵21 (فرق ${21 - 2}) ⟶ ${jumpsAboveRecord(21, 2)}`).toBe('2⟵21 (فرق 19) ⟶ false')
  })

  it('✅ والحافّتان تُقرآن من الثابتين لا من رقمٍ منسوخ', () => {
    expect(`K=${ANOMALY_RATIO} · F=${ANOMALY_FLOOR}`).toBe('K=10 · F=20')
    // الحدُّ نفسُه محسوبًا من الثابتين — فتغييرُهما يحرّك هذا الاختبارَ معه
    // بدل أن يتركه يحرس رقمًا لم يعد القاعدةَ.
    expect(jumpsAboveRecord(ANOMALY_RATIO * 3, 3)).toBe(true)
    expect(jumpsAboveRecord(ANOMALY_FLOOR + 1, 1)).toBe(true)
  })

  it('✅ وما ليس عددًا لا يومض ولا ينفجر', () => {
    expect(jumpsAboveRecord(null, 150)).toBe(false)
    expect(jumpsAboveRecord(1950, null)).toBe(false)
    expect(jumpsAboveRecord('كتير', 150)).toBe(false)
    expect(jumpsAboveRecord(undefined, undefined)).toBe(false)
  })
})

describe('③ الاستقرارُ — والمقارنةُ بالقيمة لا براية «قد غادر»', () => {
  it('🔴 خانةٌ لم تُغادَر ⟵ غيرُ مستقرّة، مهما كان رقمُها', () => {
    expect(settledCount({}, 'p1', '1950')).toBe(false)
    expect(settledCount(null, 'p1', '1950')).toBe(false)
  })

  it('🔴 غودرت ثمّ تغيّر الرقمُ ⟵ تعود غيرَ مستقرّة، بلا كتابةِ حالةٍ ثانية', () => {
    expect(settledCount({ p1: '1950' }, 'p1', '1950')).toBe(true)
    expect(settledCount({ p1: '1950' }, 'p1', '195')).toBe(false)
  })

  it('✅ والفراغُ قيمةٌ كأيّ قيمة — يُغادَر ويستقرّ', () => {
    expect(settledCount({ p1: '' }, 'p1', '')).toBe(true)
    expect(settledCount({ p1: '' }, 'p1', '5')).toBe(false)
    // ⚠️ **ومنتجٌ آخرُ لا يرث استقرارَ جاره** — والخانةُ لكلّ سطرٍ على حدة.
    expect(settledCount({ p1: '1950' }, 'p2', '1950')).toBe(false)
  })
})

describe('④ والورقةُ لا ترسمه قبل المغادرة — وهو النمطُ نفسُه', () => {
  const sheet = (counts) => renderToStaticMarkup(React.createElement(StocktakingSheet, {
    products: [CARTON],
    categories: [{ id: 'c1', name: 'مجلّد', parent_id: null }],
    storageCategories: [{ category_id: 'c1', storage_id: 'st1' }],
    balances: [{ storage_id: 'st1', product_id: 'p1', balance_base: 150, avg_cost: 10 }],
    // 🔴 **المسجَّلُ يُبنى من حركاتٍ حقيقيّةٍ لا من `balances`** — `planOf` تجمع
    // `stock_movements`، **وهي بعينها `sum(quantity_base)` التي يحسبها
    // `post_stocktake_session`.** وتجهيزةٌ بلا حركاتٍ تعطي مسجَّلًا صفرًا،
    // **فيصمت الحارسُ لسببٍ صحيحٍ ويُقرأ نجاحًا كاذبًا.**
    movements: [{
      storage_id: 'st1', product_id: 'p1', document_id: 'd1', quantity_base: 150,
    }],
    documents: [{ id: 'd1', doc_type: 'supply', doc_date: '2026-08-01' }],
    storageId: 'st1', storageName: 'مستودع', salonId: 's1', userId: 'u1',
    loading: false, error: null, onClose: () => {},
    stocktake: {
      session: { id: 's' },
      counts,
      // 🔴 **`unit` لا `pcs` — والاسمان يبدوان مترادفين وليسا.** `baseUnitsFor`
      // تعرف `unit`/`package`، **و`'pcs'` وحدةُ المنتج لا إطارُ الخانة** —
      // فتُرجع عدمًا، فتصير `factBase` عدمًا، **فيصمت الحارسان معًا لسببٍ لا
      // علاقةَ له بما يُقاس.** ⚠️ **ووقع فعلًا في أوّل كتابةٍ لهذا الملفّ**،
      // ولم يُمسَك إلّا لأن الصفَّ المقابل (تنبيهُ الكسر) **يتوقّع رسمًا**:
      // **الصفُّ الذي يتوقّع صمتًا كان سيمرّ خضراءَ بالخطأ.**
      uoms: { p1: 'unit' },
      setCounts: () => {},
      setUoms: () => {},
      writeCount: () => {},
      discard: () => {},
    },
  }))

  it('✅ التجهيزةُ نفسُها صادقة: المسجَّلُ يصل الورقةَ ١٥٠ لا صفرًا', () => {
    // ⚠️ **بيّنةُ صدقٍ للتجهيزة قبل الحكم عليها** — بلا هذا السطر يمرّ الاختبارُ
    // التالي على ورقةٍ مسجَّلُها صفرٌ، **وصمتُ الحارس فيها صحيحٌ ولا يعني شيئًا.**
    expect(`المسجَّلُ مرسوم: ${sheet({}).includes('>150<')}`).toBe('المسجَّلُ مرسوم: true')
  })

  it('🔴 رقمٌ قافزٌ والخانةُ لم تُغادَر بعد ⟵ لا تنبيه', () => {
    // **هذا هو الحارسُ:** لو رُبط التنبيهُ بـ`onChange` كأخيه فوقه، **لومض هنا.**
    expect(`التنبيهُ مرسوم: ${sheet({ p1: '1950' }).includes('data-jump-hint')}`)
      .toBe('التنبيهُ مرسوم: false')
  })

  it('✅ وتنبيهُ «القطع ما بتتجزّأ» يبقى فوريًّا — فالفرقُ مقصودٌ لا سهو', () => {
    // ⚠️ **الاثنان في نفس الخليّة**، فلولا هذا الصفِّ لقُرئ صمتُ الأوّل عطلًا
    // عامًّا في الرسم لا قرارًا في موضعٍ واحد.
    const html = sheet({ p1: '7.5' })
    expect(`الكسرُ يومض فورًا: ${html.includes('data-whole-pieces-hint="p1"')}`)
      .toBe('الكسرُ يومض فورًا: true')
  })
})

describe('⑤ والوصلُ في الشاشة يُقرأ من مصدرها، لا يُفترَض', () => {
  const SRC = fs.readFileSync(path.join(ROOT, 'components/StocktakingSheet.js'), 'utf8')

  it('🔴 التنبيهُ مشروطٌ بالاستقرار — والشرطان معًا لا أحدُهما', () => {
    expect(`الشرطُ موصول: ${SRC.includes('settledCount(blurred, product.id, fact)')}`)
      .toBe('الشرطُ موصول: true')
    expect(`والقاعدةُ معه: ${SRC.includes('jumpsAboveRecord(factBase, plan)')}`)
      .toBe('والقاعدةُ معه: true')
  })

  it('🔴 و`onBlur` هي ما يسجّل الاستقرار — لا `onChange`', () => {
    // ⚠️ **الإبرةُ على السطر لا على الملفّ:** وجودُ `setBlurred` في مكانٍ ما
    // لا يقول أين نُودي، **و«في مكانٍ ما» هو ما تفشل به القوائم مفتوحةً.**
    const inChange = /onChange=\{\(e\) => setCounts\([^}]*setBlurred/s.test(SRC)
    expect(`setBlurred داخلَ onChange: ${inChange}`).toBe('setBlurred داخلَ onChange: false')

    const blur = SRC.slice(SRC.indexOf('onBlur={(e) => {'))
    expect(`setBlurred داخلَ onBlur: ${blur.slice(0, 200).includes('setBlurred(')}`)
      .toBe('setBlurred داخلَ onBlur: true')
  })

  it('🔴 ولا نسخةَ ثانيةً للقاعدة في الشاشة', () => {
    // **البندُ (ب) في `CLAUDE.md` بلبوس المقدار** — نسختان تتباعدان بأوّل تعديل،
    // فيصير ما يُنبَّه به غيرَ ما يُسأل عنه.
    const free = (SRC.match(/ANOMALY_RATIO|ANOMALY_FLOOR|\*\s*10\b/g) || []).length
    expect(`ثوابتُ مكتوبةٌ في الشاشة: ${free}`).toBe('ثوابتُ مكتوبةٌ في الشاشة: 0')
  })
})
