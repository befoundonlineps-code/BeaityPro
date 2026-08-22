// شريطُ العنوان الأزرق — **الشكلُ وحدَه، منزوعًا من آلته.**
//
// 🔴 **استخراجٌ تجميليٌّ بشرطِ المالك، لا إعادةَ استعمالٍ لبنية `Dialog`:**
// «الاستخراجُ تجميليٌّ فقط (شكلُ الشريط)، بلا أيّ إعادةِ استعمالٍ لبنية
// Dialog/Portal تبع RefModal. لوحُ العرض يبقى `<div>` يدويّ، **يستعير الشكلَ
// لا الآلية**».
//
// ⚠️ **ولماذا يستحيل غيرُ ذلك هنا، مقيسًا لا تفضيلًا:** الصفحةُ تلفّ العمليّةَ
// بـ`RefModal` أصلًا، **ولوحُ العرض يُفتح فوقها** — و«حوارٌ داخل حوارٍ كلّف
// جولةً كاملةً في هذا المشروع» (`StockDocumentsList:25`). فبنيةُ `Dialog`
// الثانيةُ تتنازع على بؤرة اللوحة، **والشكلُ وحدَه لا يتنازع على شيء.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا زرَّ في هذا الملفّ — **العنوانُ والإغلاقُ يصلان عقدتين**
// ══════════════════════════════════════════════════════════════════
//
// **وهذا ليس أناقةً — هو ما يجعل الملفَّ يمرّ بحارس `components/ref/`.**
// وأهمُّ منه أنه يبقي لكلّ مناديه آليّتَه هو:
//
// ```
// RefModal            DialogPrimitive.Title + DialogPrimitive.Close  ⟵ ربطُ a11y ومصيدةُ البؤرة
// لوحُ عرض المستندات   <span> + <button onClick>                      ⟵ إغلاقٌ يدويٌّ بلا حوار
// ```
//
// ⚠️ **ولو ابتلع هذا الملفُّ العنوانَ عنصرًا لسقط ربطُ `aria-labelledby`** الذي
// يعطيه `DialogPrimitive.Title` — **تغييرُ سلوكٍ في عشر عمليّاتٍ قائمة**، وهو
// ما اشترط المالكُ ألّا يقع.

// تُصدَّر لأن المنادِيَ يضعها على عقدته هو — **موضعٌ واحدٌ للمظهر، وآليّتان.**
export const CHROME_TITLE = 'truncate text-xs font-semibold'
export const CHROME_CLOSE = 'flex size-5 shrink-0 items-center justify-center hover:bg-black/10'
export const CHROME_BAR = 'flex shrink-0 items-center justify-between gap-2 px-2 py-1'
export const CHROME_BAR_STYLE = { background: 'var(--chrome)', color: 'var(--chrome-ink)' }

export default function RefChromeBar({ title, close }) {
  return (
    <div className={CHROME_BAR} style={CHROME_BAR_STYLE}>
      {title}
      {close}
    </div>
  )
}
