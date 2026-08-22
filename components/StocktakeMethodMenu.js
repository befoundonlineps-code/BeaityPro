import { useTranslation } from 'next-i18next'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { RefTag } from './ref/RefGrid'

// قائمةُ طرق الجرد الثلاث — **واحدةٌ تعمل، واثنتان غيابُهما مُعلَن.**
//
// 🔴 **وهذا يعكس قرارًا مكتوبًا، ويُعكس صراحةً لا بصمت.** كان
// `productsOperations.js` يقول: «سهمٌ يكشف مدخلًا واحدًا **هو قائمةٌ تكذب
// بشأن وجود اختيار**» — وهو صحيحٌ عن مدخلٍ **يبدو صالحًا ولا يفعل شيئًا.**
//
// ⇒ **والحجّةُ الجديدة: خيارٌ معطَّلٌ بسببٍ ظاهرٍ غيابٌ مُعلَن، لا خيارٌ كاذب.**
// المستخدمُ يرى أن الطريقَ موجودٌ في المنتج المرجعيّ وغيرُ مبنيٍّ عندنا بعد،
// **ويقرأ لماذا** — وهذا أصدقُ من إخفاءٍ يجعله يبحث عن ميزةٍ يظنّها موجودة.

// ⚠️ **معطَّلٌ بالبنية لا بالسلوك — والفرقُ هو كلُّ المسألة.**
//
// **ليس `DropdownMenuItem disabled`**: ذاك عنصرٌ تفاعليٌّ بخاصّيّةٍ تمنعه،
// **وشرطٌ يُنسى أو خاصّيّةٌ تُحذف تعيده إلى الحياة.** وهذا `<div>` **بلا
// `onSelect` ولا `onClick` ولا أيّ معالِج إطلاقًا** — فلا شيءَ فيه ليُنسى.
//
// وهو نفسُ أسلوب شاشات العرض، ويحرسه `lib/stocktakeScreenShape.test.js`.
//
// ⚠️ **وهذا السطرُ كان يسمّي ملفًّا لا وجودَ له** (`stocktakeMethodsInert`) —
// **اسمٌ تخيّلتُه قبل أن أكتب الحارس ولم أعد أقرؤه بعده.** ولا شيءَ كان
// ليشتكي: تعليقٌ يشير إلى مسارٍ غيرِ موجودٍ يُقرأ ضمانةً ولا يُفحص.
function DisabledMethod({ id, label, tag, help }) {
  return (
    <div
      data-method-disabled={id}
      title={help}
      className="flex cursor-not-allowed items-center justify-between gap-3 px-2 py-1.5 text-xs text-muted-foreground opacity-70"
    >
      <span>{label}</span>
      <RefTag>{tag}</RefTag>
    </div>
  )
}

export default function StocktakeMethodMenu({ children, onManual, disabled }) {
  const { t } = useTranslation(['products', 'common'])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <span className="inline-flex items-center gap-0.5" data-stocktake-methods="">
          {children}
          <ChevronDown className="size-3" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {/* ✅ **الطريقُ الوحيدُ المبنيّ — وهو وحدَه عنصرٌ تفاعليّ.** */}
        <DropdownMenuItem onClick={onManual} data-method="manual">
          {t('products:stocktakePeriod.methodManual')}
        </DropdownMenuItem>

        <DisabledMethod
          id="barcode"
          label={t('products:stocktakePeriod.methodBarcode')}
          tag={t('products:stocktakePeriod.methodDisabledTag')}
          help={t('products:stocktakePeriod.methodBarcodeHelp')}
        />
        <DisabledMethod
          id="excel"
          label={t('products:stocktakePeriod.methodExcel')}
          tag={t('products:stocktakePeriod.methodDisabledTag')}
          help={t('products:stocktakePeriod.methodExcelHelp')}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
