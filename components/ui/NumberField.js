import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Input } from '@/components/ui/input'
import { roundTyped } from '../../lib/decimalPlaces'

// حقلٌ رقميّ يقرّب ما يُكتب بالإيد إلى خانتين — **ويقول إنه فعل.**
//
// 🔴 قرارُ المالك: «تقريب تلقائي لخانتين، مع رسالة واضحة توضح للمستخدم إنه تم
// تقريب الرقم — مو تقريب صامت. لازم يشوف بوضوح إنه اللي كتبه انغيّر ولشو.»
//
// ⚠️ **والتقريبُ عند مغادرة الحقل لا عند كلّ ضغطةِ مفتاح.** من يكتب «10.005»
// يمرّ حتمًا بـ«10.0» ثمّ «10.00»، وتقريبٌ أثناء الكتابة **يقاتل صاحبَه وهو في
// منتصف رقمِه** — فيبدو الحقلُ معطّلًا لا حارسًا.
//
// ⚠️ **والرسالةُ تحمل الثلاثة التي تجعلها نافعة** (قاعدةُ المشروع): ماذا حدث
// (قُرِّب) · **من أيّ رقمٍ إلى أيّ رقم** — فبلا الأصل يعرف القارئُ أن شيئًا
// تغيّر ولا يعرف ماذا فقد · ولماذا (الخانتان). **وتختفي بأوّل تعديلٍ تالٍ**،
// لأنها خبرٌ عن فعلٍ مضى لا حالةٌ قائمة.
//
// ⚠️ **وتُرسم تحت الحقل، فتزيح ما تحتها لحظةَ ظهورها — وذلك مقصود.** الإزاحةُ
// هي ما يلفت العين، والبديلُ (`title` أو لونٌ خافت) هو بالضبط «التقريب الصامت»
// الذي رُفض، بلبوسٍ ألطف.
//
// ⚠️ **والواجهةُ نفسُها واجهةُ `<Input>`**: `value` و`onChange(e)`. فالمناداةُ
// عند التقريب تصنع `{ target: { value } }` — محوّلٌ مقصودٌ لا حيلة، لأن كلّ
// موضعٍ في هذا المستودع يقرأ `e.target.value`، وتغييرُ العشرين موضعًا إلى توقيعٍ
// آخر تغييرٌ أكبر من الميزة.
export default function NumberField({ value, onChange, onBlur, ...rest }) {
  const { t } = useTranslation('common')
  const [rounding, setRounding] = useState(null)

  function handleBlur(event) {
    const answer = roundTyped(event.target.value)
    if (answer.rounded) {
      setRounding({ from: answer.from, to: answer.text })
      onChange({ target: { value: answer.text } })
    }
    if (onBlur) onBlur(event)
  }

  function handleChange(event) {
    // الرسالةُ خبرٌ عن الكتابة السابقة، فتذهب مع أوّل حرفٍ جديد.
    if (rounding) setRounding(null)
    onChange(event)
  }

  return (
    <>
      <Input
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        {...rest}
      />
      {rounding && (
        <p className="text-xs text-amber-700 dark:text-amber-400" data-rounded-notice>
          {t('common:roundedToPlaces', { from: rounding.from, to: rounding.to })}
        </p>
      )}
    </>
  )
}
