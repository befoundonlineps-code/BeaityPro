const fs = require('fs')
const path = require('path')
const {
  DOCUMENT_VIEWS, VIEWS, REFERENCE_FORM_VIEWS, usesReferenceForm, usesSharedDocumentScreen, isDocumentView,
} = require('./productsView')

// 🔴 الحارسُ الذي يمنع شاشةً من السقوط بين المكوّنَين.
//
// ⚠️ **الشاشةُ المشتركةُ شاشاتٌ كثيرة.** `StockDocumentScreen` يخدم أربعَ
// عمليّاتٍ خلف `docType`، والتحويلُ إلى شكل المرجعيّة يسحب واحدةً منها في كلّ
// جولة. **والعطلُ الذي يصنعه ذلك صامتٌ تمامًا:** عمليّةٌ تخرج من الشرط القديم
// ولا تدخل الجديد **لا يرسمها أحد** — النافذةُ تفتح فارغةً، ولا خطأَ ولا سطرَ
// في أيِّ سجلّ.
//
// ⚠️ **ولا اختبارَ مكوّنٍ يمسك هذا الصنف**، لأن كلَّ اختبارٍ منها يستورد مكوّنَه
// ويرسمه مباشرةً — فهو يثبت أن المكوّنَ يعمل، لا أن أحدًا يناديه.
//
// فالسؤالُ هنا واحد: **هل لكلّ عمليّةِ مستندٍ طريقُ رسمٍ واحدٌ بالضبط؟**
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'pages', 'products', 'index.js'), 'utf8')

describe('كلُّ عمليّةِ مستندٍ لها مكوّنٌ يرسمها', () => {
  it('القائمتان تقسمان عمليّاتِ المستندات بلا تداخلٍ وبلا ثغرة', () => {
    for (const view of DOCUMENT_VIEWS) {
      const ref = usesReferenceForm(view)
      const shared = usesSharedDocumentScreen(view)
      // ⚠️ `not.toBe` على قيمتين منطقيّتين — أي أن واحدةً بالضبط صادقة.
      // ولو صارتا كاذبتين معًا لسقطت العمليّةُ من الرسم بلا أن يشتكي شيء.
      expect(ref).not.toBe(shared)
    }
  })

  it('ولا عمليّةَ مستندٍ بلا طريق', () => {
    const orphans = DOCUMENT_VIEWS.filter((v) => !usesReferenceForm(v) && !usesSharedDocumentScreen(v))
    expect(orphans).toEqual([])
  })

  it('كلُّ شاشةٍ محوَّلةٍ منادَاةٌ فعلًا في الصفحة، لا معرَّفةً وحدَها', () => {
    // 🔴 هذا هو النصفُ الذي لا تراه القوائم: اسمٌ في `REFERENCE_FORM_VIEWS`
    // بلا فرعِ رسمٍ في الصفحة **يُخرج العمليّةَ من الشاشة المشتركة ولا يضعها في
    // مكانٍ آخر** — وهو بالضبط العطلُ الصامت.
    for (const view of REFERENCE_FORM_VIEWS) {
      expect(PAGE).toContain(`op === '${view}'`)
    }
  })

  it('الصفحةُ ما عادت توجّه بـisDocumentView وحدَها', () => {
    // ⚠️ لو رجع الشرطُ القديم لرُسمت `supply` مرّتين — مرّةً بالمكوّن الجديد
    // ومرّةً بالمشترك — وهي حالةٌ تبدو على الشاشة فوضى لا خطأً مسمّى.
    expect(PAGE).toContain('usesSharedDocumentScreen(op)')
    expect(PAGE).not.toMatch(/\{\s*isDocumentView\(op\)\s*&&/)
  })

  it('كلُّ اسمٍ في القائمتين هو عرضٌ يعرفه النظام', () => {
    // قائمةٌ مكتوبةٌ بيد تفشل مفتوحةً: اسمٌ مطبوعٌ خطأً يخرج من كلّ الشروط
    // بصمت. فتُقارَن بمصدرِ الحقيقة بدل أن تُقرأ وحدَها.
    for (const view of REFERENCE_FORM_VIEWS) expect(VIEWS).toContain(view)
  })

  it('`orders` محوَّلةٌ وليست عمليّةَ مستندٍ أصلًا — والقائمتان لا تتناقضان', () => {
    // الطلبيّةُ تكتب في جدولها هي، فهي ليست في DOCUMENT_VIEWS رغم أنها محوَّلة.
    // وهذا يثبت أن `usesSharedDocumentScreen` تسأل عن الاثنين لا عن واحد.
    expect(isDocumentView('orders')).toBe(false)
    expect(usesReferenceForm('orders')).toBe(true)
    expect(usesSharedDocumentScreen('orders')).toBe(false)
  })
})
