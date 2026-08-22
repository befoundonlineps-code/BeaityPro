/**
 * 🔴 **أعمدةُ المال في شاشة الجرد — والحبّةُ هي المسألة كلُّها.**
 *
 * سعرُ البيع عندنا **للعبوة** والفرقُ **بالقطع**. ⇒ **فضربُهما مباشرةً خطأٌ
 * بمقدار معامل التعبئة كاملًا** — ١٥ ضعفًا على منتجٍ عبوتُه ١٥، لا كسرًا
 * كـ`100.0005`. **وهذا الملفُّ يثبّت التحويلَ ويقيس الخطأَ الذي يمنعه.**
 *
 * ⚠️ **والعدمُ يبقى عدمًا:** كلُّ دالّةٍ هنا تُرجع `null` لا صفرًا حين ينقص
 * مُدخَلُها — والصفرُ ادّعاءٌ («مجّانًا» · «طابق» · «لا قيمة لفقده»).
 */

const {
  costPerBaseUnit, remainingTotal, differenceBase,
  differenceAtCost, differencePackages, differenceAtRetail,
} = require('./stocktakeMoney')

// منتجُ المالك المقيس: عبوةٌ فيها ١٥ قطعة (`CLAUDE.md`, OWNER_PRODUCTS).
const PACKED = { id: 'p', units_per_package: 15, package_price: 200 }
const LOOSE = { id: 'q', units_per_package: 1, package_price: 80 }

describe('مالُ الجرد — الحبّةُ تُسمّى ولا شيءَ يُخترع', () => {
  it('🔴 قيمةُ المتوفّر = الفعليُّ بالوحدة الأساسيّة × تكلفةِ الوحدة', () => {
    expect(remainingTotal({ factBase: 20, cost: 38 })).toBe(760)
    expect(remainingTotal({ factBase: 40, cost: 130 })).toBe(5200)
    expect(remainingTotal({ factBase: 40, cost: 70 })).toBe(2800)
  })

  it('⚠️ وتكلفةٌ غيرُ معروفةٍ تُرجع عدمًا لا صفرًا', () => {
    expect(costPerBaseUnit({ avg_cost: null })).toBeNull()
    expect(costPerBaseUnit(null)).toBeNull()
    expect(costPerBaseUnit({ avg_cost: '6.6667' })).toBe(6.6667)
    expect(remainingTotal({ factBase: 12, cost: null })).toBeNull()
  })

  it('🔴 ولا فعليَّ ⟵ لا فرق، لا صفر', () => {
    // خانةٌ لم تُملأ ليست «طابق» — والصفرُ يدّعي أن العدَّ جرى.
    expect(differenceBase({ factBase: null, planBase: 40 })).toBeNull()
    expect(differenceBase({ factBase: '', planBase: 40 })).toBeNull()
    expect(differenceBase({ factBase: 40, planBase: 40 })).toBe(0)
    expect(differenceBase({ factBase: 38, planBase: 40 })).toBe(-2)
  })

  it('⚠️ وقيمةُ الفرق بالتكلفة على نفس الحبّة', () => {
    expect(differenceAtCost({ difference: -2, cost: 38 })).toBe(-76)
    expect(differenceAtCost({ difference: -2, cost: null })).toBeNull()
    expect(differenceAtCost({ difference: null, cost: 38 })).toBeNull()
  })

  // ══════════════════════════════════════════════════════════════════
  // 🔴 التحويلُ إلى عبوات — قرارُ المالك، والرقمُ الكسريُّ مقبول
  // ══════════════════════════════════════════════════════════════════
  it('🔴 الفرقُ بالعبوات كسريٌّ ومقبول — عشرون قطعةً من عبوةِ ١٥ = ١٫٣٣', () => {
    expect(differencePackages({ difference: -20, product: PACKED })).toBe(-1.33)
    expect(differencePackages({ difference: 20, product: PACKED })).toBe(1.33)
    expect(differencePackages({ difference: -15, product: PACKED })).toBe(-1)
    // ⚠️ ومنتجٌ بلا تعبئةٍ معامله ١ — فالقطعةُ عبوة.
    expect(differencePackages({ difference: -7, product: LOOSE })).toBe(-7)
  })

  it('🔴 وقيمةُ الفرق بسعر البيع تمرّ بالعبوات — ومقيسٌ ما يمنعه', () => {
    // ⚠️ **الصحيح:** −٢٠ قطعة ⟵ −١٫٣٣ عبوة ⟵ × ٢٠٠ = −٢٦٦
    expect(differenceAtRetail({ difference: -20, product: PACKED })).toBe(-266)

    // 🔴 **والخطأُ الذي يمنعه التحويل، مقيسًا:** ضربُ القطع في سعر العبوة
    // مباشرةً يعطي −٤٠٠٠ — **خمسةَ عشرَ ضعفًا، لا كسرًا.**
    const naive = -20 * PACKED.package_price
    expect(`الصحيح: ${differenceAtRetail({ difference: -20, product: PACKED })} · الساذج: ${naive}`)
      .toBe('الصحيح: -266 · الساذج: -4000')
  })

  it('⚠️ ومنتجٌ بلا سعر بيعٍ يُرجع عدمًا — لا «صفرَ قيمة»', () => {
    const priceless = { id: 'r', units_per_package: 15, package_price: null }
    expect(differenceAtRetail({ difference: -20, product: priceless })).toBeNull()
    expect(differenceAtRetail({ difference: null, product: PACKED })).toBeNull()
    expect(differenceAtRetail({ difference: -20, product: null })).toBeNull()
  })

  // ⚠️ **منزلتان، من الثابتة القائمة لا من رقمٍ لهذه الشاشة.**
  it('⚠️ والتقريبُ منزلتان — نفسُ سقف المشروع', () => {
    // ١٠ ÷ ٣ = ٣٫٣٣٣٣… ⟵ منزلتان
    expect(differencePackages({ difference: 10, product: { units_per_package: 3 } })).toBe(3.33)
    // ⚠️ **والقيمةُ تُحسب من العبوات المقرَّبة، لا من كسرٍ كامل** — فالرقمُ
    // المعروضُ للموظّفة هو نفسُه الذي ضُرب. **وعرضُ ١٫٣٣ وضربُ ١٫٣٣٣٣ هو
    // «رقمان لسؤالٍ واحد» بعينه.**
    expect(differenceAtRetail({ difference: 10, product: { units_per_package: 3, package_price: 10 } }))
      .toBe(33.3)
  })
})
