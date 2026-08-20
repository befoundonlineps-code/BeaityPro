import { ChevronDown } from 'lucide-react'

// بدائلُ ساكنةٌ تبدو كعناصر الإدخال ولا تقبل إدخالًا — **لشاشات العرض وحدَها.**
//
// 🔴 **القاعدةُ التي وُلدت منها، بلفظ المالك:** «شاشةُ العرض = نفسُ شاشة الإنشاء
// بصريًّا بالحرف — نفسُ الرأس، نفسُ الجدول، نفسُ الذيل، نفسُ الترتيب — **وكلُّ
// عنصرٍ تفاعليٍّ يُستبدل بنصٍّ ثابت**».
//
// ⚠️ **ولماذا لا `disabled` على العنصر الحقيقيّ:** ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل** — يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.** و`disabled`
// خاصّيّةٌ تُنسى على عنصرٍ واحد؛ **والعنصرُ غيرُ الموجودِ لا يُنسى.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا `<button>` هنا ولا `onClick` — والملفُّ نفسُه محروسٌ بذلك
// ══════════════════════════════════════════════════════════════════
//
// **هذا الملفُّ خارجُ `components/documentView/`، فلا يمسحه حارسُ الشاشات
// تلقائيًّا** — **وشاشاتُ العرض تستورده.** ⇒ **فثقبٌ هنا يمرّ إلى الأربع دفعةً
// واحدة**، ولذلك يُمسح بالاسم في `viewScreensAreInert.test.js`.
//
// ⚠️ **وهو نفسُ صنف «قدرةٌ مركزيّةٌ ومستهلكٌ ما انربط فيها» معكوسًا:** الحارسُ
// سليمٌ ومدًى واحدٌ خارجَه.

// نفسُ أصنافِ `FIELD` في شاشات الإدخال، **حرفًا بحرف**، وعليها خلفيّةٌ رماديّة.
//
// ⚠️ **و`w-full min-w-0` منقولةٌ من `components/ui/input.jsx`** — بدونها ينكمش
// الصندوقُ إلى محتواه، **فيختلف عرضُ الرأس عن شاشة الإنشاء** وهي أوّلُ ما
// يُقارَن بالعين.
const FIELD_LOOK = 'h-7 w-full min-w-0 rounded-none border border-[var(--rule)] '
  + 'bg-[var(--group)] px-1.5 text-xs flex items-center'

// خانةٌ تبدو حقلَ إدخالٍ معطَّلًا. **الفراغُ يبقى فراغًا** — لا «—» فيها، لأن
// الخانةَ الفارغةَ في شاشة الإنشاء فارغةٌ كذلك.
export function StaticField({ children, className = '' }) {
  return <span className={`${FIELD_LOOK} ${className}`}>{children}</span>
}

// خانةٌ تبدو منسدلًا معطَّلًا — بسهمها في طرفها كما يرسمه المتصفّح.
export function StaticSelect({ children, className = '' }) {
  return (
    <span className={`${FIELD_LOOK} justify-between gap-1 ${className}`}>
      <span className="truncate">{children}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" />
    </span>
  )
}

// صندوقُ ملاحظاتٍ يبدو `textarea` معطَّلًا — بارتفاع سطرين كما في الإنشاء.
export function StaticArea({ children, className = '' }) {
  return (
    <span
      className={'block w-full min-w-0 rounded-none border border-[var(--rule)] '
        + `bg-[var(--group)] px-1.5 py-1 text-xs min-h-[3.25rem] whitespace-pre-wrap ${className}`}
    >
      {children}
    </span>
  )
}

// 🔴 زرُّ الإرسال — **`<span>` يبدو زرًّا معطَّلًا، وليس `<button>` بالمطلق.**
// بلفظ المالك: «لا `onClick`، لا `type="submit"`. ليس `<button>` بالمطلق».
export function StaticActionButton({ children }) {
  return (
    <span
      data-static-action
      aria-disabled="true"
      className="flex h-8 min-w-[120px] cursor-not-allowed items-center justify-center px-4 text-xs font-semibold opacity-40"
      style={{ background: 'var(--chrome)', color: 'var(--chrome-ink)' }}
    >
      {children}
    </span>
  )
}

// «إلغاء» و«رجوع للمجلدات» — **ديكورٌ كذلك بقرار المالك**: «كلُّ الأزرار…
// ديكورٌ بلا `onClick` بتاتًا، بلا استثناء». **والأبسطُ أضمن.**
export function StaticCancelButton({ children }) {
  return (
    <span
      aria-disabled="true"
      className="flex h-8 min-w-[100px] cursor-not-allowed items-center justify-center border border-[var(--rule)] bg-white px-4 text-xs opacity-60"
    >
      {children}
    </span>
  )
}

// ضابطٌ بأيقونةٍ ونصّ — «إدخال من فاتورة» · «إكسل» · «الكل».
// ⚠️ **وشاشةُ الإنشاء ترسم بعضَها معطَّلًا أصلًا** (`ShellControl`) وبعضَها
// عاملًا، **وهنا يتساويان في المظهر المعطَّل** لأن أيًّا منهما لا يعمل.
export function StaticShellButton({ icon: Icon, children, className = '' }) {
  return (
    <span
      aria-disabled="true"
      className={'flex h-7 cursor-not-allowed items-center gap-1 border border-[var(--rule)] '
        + `px-2 text-xs text-muted-foreground opacity-60 ${className}`}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  )
}
