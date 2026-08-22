import { useTranslation } from 'next-i18next'
import { Search, FileSpreadsheet, FileInput, Filter } from 'lucide-react'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from '../ref/RefGrid'
import {
  StaticField, StaticSelect, StaticArea, StaticCheckbox,
  StaticActionButton, StaticCancelButton, StaticShellButton,
} from '../ref/RefStatic'
import { movementsOf, movementFrames } from '../../lib/stockDocumentList'
import { balanceIndex } from '../../lib/orderGrid'
// 🔴 **سطورُ المستند مرجعًا وكتالوجُ اليوم حشوًا** — والحالةُ الحافّةُ فيه مختبَرة.
import { documentViewRows } from '../../lib/documentViewRows'
import { numberOrNull, roundToPlaces } from '../../lib/decimalPlaces'

// «توريد بضاعة» — **مشاهدةً.** صورةُ شاشة الإنشاء نفسِها، منزوعةَ الوظيفة.
//
// **المعيارُ الموحَّد بلفظ المالك:** «شاشةُ العرض = نفسُ شاشة الإنشاء بصريًّا
// بالحرف — نفسُ الرأس، نفسُ الجدول، نفسُ الذيل، نفسُ الترتيب — **وكلُّ عنصرٍ
// تفاعليٍّ يُستبدل بنصٍّ ثابت**»، **ولا زرَّ يعمل: «ديكورٌ بلا `onClick`
// بتاتًا، بلا استثناء».**
//
// 🔴 **وزرُّ «للتوريد» `<span>` لا `<button>` بالمطلق** — ٠٩٤ج سحب `UPDATE` عن
// `stock_documents`، **فزرُّ إرسالٍ منسيٌّ لا يُرفَض كتعديل**: يُدرج مستندًا
// جديدًا بالكامل عبر `INSERT`. ⇒ **مستندٌ شبحيٌّ بحركاتٍ حقيقيّة.**
//
// ══════════════════════════════════════════════════════════════════
// 🔴 المبلغُ من `entered_unit_price` — قرارُ المالك (د/٤)، ومقيسٌ لماذا
// ══════════════════════════════════════════════════════════════════
//
// **شاشةُ الإنشاء لا تضرب في `unit_cost` إطلاقًا:**
//
//     orderGrid.js:85  amountOf  ⟵  العبواتُ × سعرِ العبوة
//
// و«تكلفة العبوة» هي `entered_unit_price` بعينها — `050b:18` بالنصّ: «per
// ENTERED unit — per package if that is the entered uom». ⇒ **فهذا الضربُ
// وحدَه يجعل العرضَ نسخةَ الإنشاء.**
//
// ⚠️ **والبديلُ كان سيكذب مرّتين:** `unit_cost` على حركة التوريد **مشتقٌّ من**
// `entered_unit_price ÷ units_per_package` بأربع منازل — **وهو منبعُ
// `100.0005` نفسِه** (`stockDocumentList.js:92-105`). فضربُه في `quantity_base`
// **يخالف رقمَ شاشة الإنشاء ويحمل البقيّةَ معه** (عند عشر عبواتٍ فصاعدًا:
// ١٬٠٠٠٫٠١ مقابل ١٬٠٠٠٫٠٠).
//
// ══════════════════════════════════════════════════════════════════
// 🔴 ولا كتلةَ دفعٍ هنا — والغيابُ مقيسٌ لا منسيّ
// ══════════════════════════════════════════════════════════════════
//
//     productsView.js:35  REFERENCE_FORM_VIEWS = [orders, supply, write_off, return_to_supplier]
//     ⇒ التوريدُ يرسم SupplyProductsScreen اليومَ لا StockDocumentScreen
//     ⇒ و`post()` فيها ترسل عشرةَ حقولٍ ليس فيها paidAmount ولا paymentMethod
//
// ⇒ **شاشةُ الإنشاء بلا حقلِ دفعٍ إطلاقًا، فشاشةُ العرض بلا كتلةِ دفع.**
// **والإرجاعُ يفترق** — `ReturnToSupplierScreen:70` يملك الحقلين فعلًا.
//
// ══════════════════════════════════════════════════════════════════
// الأعمدةُ الستّة — **بنفس الترتيب وبنفس العروض**
// ══════════════════════════════════════════════════════════════════
//
// ```
// المنتج · العبوات(w-24) · الكمّيّة(w-28) · الرصيد الحاليّ(w-32) · تكلفة العبوة(w-28) · المبلغ(w-28)
// ```
//
// ✅ **و«الرصيد الحاليّ» رصيدُ اليوم** — بقرار المالك صراحةً، **وبنفس دالّة
//    شاشة الإنشاء** (`balanceIndex`) فلا يفترق الرقمان. ⚠️ **وهو ادّعاءٌ عن
//    الحاضر على سطرٍ ماضٍ، ويُقال هنا لأنه لا يُقرأ من الشاشة.**
//
// 🔴 **و«المجموع» موضعُه وتسميتُه دائمًا، وقيمتُه «—» دائمًا** — قرارُ المالك
//    موحَّدًا على الأربع: «نفسُ الذيل» تطلب موضعَه، **و د/١ تحظر مجموعَ
//    السطور.** ⇒ **فلا يختلّ التخطيطُ ولا يُحسَب محظور.**
const COLUMNS = 6

export default function SupplyDocumentView({
  document: doc, movements, products, categories, storageCategories, storages, suppliers, balances,
}) {
  const { t } = useTranslation(['products', 'common'])
  if (!doc) return null

  const nameIn = (list, id) => (id ? (list || []).find((x) => x && x.id === id)?.name || null : null)
  const supplierName = nameIn(suppliers, doc.supplier_id)
  // 🔴 **`storage_id` لا `to_storage_id`** — `supply` عندها `twoStorages: false`،
  // والحقلُ يُسمّى «إلى مستودع» في شاشة الإنشاء ويُرسَل `storageId`.
  const storageName = nameIn(storages, doc.storage_id)

  // ⚠️ **بنفس دالّة شاشة الإنشاء ونفسِ مستودعها** — «الرصيدُ الحاليّ» من
  // المستودع الذي **وصلت إليه** البضاعة، لا من عدسةٍ أخرى.
  const stock = balanceIndex(balances, doc.storage_id)

  // ══════════════════════════════════════════════════════════════════
  // 🔴 سطورُ المستند مرجعًا، وكتالوجُ اليوم حشوًا — **بهذا الترتيب**
  // ══════════════════════════════════════════════════════════════════
  //
  // **والبناءُ كلُّه في `documentViewRows`، ومعه اختبارُ الحالة الحافّة:**
  // منتجٌ ورّد من سنةٍ ثمّ أُرشِف أو حُذف أو فُكّ ربطُ مجلّده — **يخرج من كتالوج
  // اليوم وسطرُه باقٍ في `stock_movements` إلى الأبد.** ⇒ **يُرسم.**
  const viewRows = documentViewRows({
    lines: movementsOf(movements, doc.id),
    products,
    categories,
    storageCategories,
    storageId: doc.storage_id,
  })

  // وحدةُ المنتج الأساسيّة — تُقرأ للحشو كما تُقرأ للسطر.
  const unitOf = (product) => t(`products:units.${product?.base_unit || 'pcs'}`)

  const discount = numberOrNull(doc.discount_value)
  const transport = numberOrNull(doc.transport_amount)

  return (
    <div className="relative flex h-full flex-col gap-2">
      {/* ══ الرأسُ — نفسُ ترتيب شاشة الإنشاء وحقولها الأربعة ══ */}
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:supplyRef.fromSupplier')}
          <StaticSelect className="w-48">{supplierName || ''}</StaticSelect>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:supplyRef.toStorage')}
          <StaticSelect className="w-40">{storageName || ''}</StaticSelect>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:orders.invoiceLabel')}
          {/* ⚠️ **`supplier_doc_number` لا `doc_number`** — «رقم الفاتورة» في
              شاشة الإنشاء هو رقمُ ورقةِ المورّد. */}
          <StaticField>{doc.supplier_doc_number || ''}</StaticField>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          {t('products:orders.fromLabel')}
          <StaticField className="w-[9.5rem]">
            {String(doc.doc_date || '').slice(0, 10)}
          </StaticField>
        </span>
      </div>

      {/* ══ الجدولُ — نفسُ الأعمدة والعروض والارتفاع الأدنى ══ */}
      <div className="min-h-[220px] flex-1 overflow-auto border border-[var(--rule)]">
        <RefTable>
          <RefHead>
            <tr>
              <RefTh>{t('products:orders.productColumn')}</RefTh>
              <RefTh className="w-24">{t('products:orders.packagesColumn')}</RefTh>
              <RefTh className="w-28">{t('products:orders.numberColumn')}</RefTh>
              <RefTh className="w-32">{t('products:orders.inStockColumn')}</RefTh>
              <RefTh className="w-28">{t('products:supplyRef.unitCostColumn')}</RefTh>
              <RefTh className="w-28">{t('products:orders.amountColumn')}</RefTh>
            </tr>
          </RefHead>
          <tbody>
            {viewRows.map((row, ri) => {
              // ── صفُّ المجلّد ─────────────────────────────────────────
              if (row.kind === 'folder') {
                return (
                  <RefGroupRow key={`f-${row.id}-${ri}`} columns={COLUMNS} data-folder-row={row.id}>
                    <span className="flex items-center gap-2">
                      {/* 🔴 **مجموعةُ السطور الخارجةِ عن كتالوج اليوم** — اسمُها
                          مفتاحُ ترجمةٍ لا اسمُ مجلّد، لأنها ليست مجلّدًا. */}
                      {row.name ?? t('products:documents.orphanFolder')}
                      {/* ⚠️ **«مجلد بلا أصناف» ادّعاءٌ عن الكتالوج لا عن المستند.**
                          🔴 **و«مجموع العبوات» لا يُرسم** — جمعٌ عبر السطور. */}
                      {row.childCount === 0 && (
                        <RefTag>{t('products:orders.folderEmpty')}</RefTag>
                      )}
                    </span>
                  </RefGroupRow>
                )
              }

              // ── صفُّ الحشو: منتجٌ من كتالوج اليوم ليس في هذا المستند ──
              //
              // 🔴 **كلُّ رقمٍ من المستند «—» لا «٠»** — «٠» توحي بقرارٍ بقيمة
              // صفر، **و«—» تعني «ليس جزءًا من هذا المستند إطلاقًا».**
              //
              // ⚠️ **و«الرصيد الحاليّ» يبقى رقمًا حقيقيًّا** — رصيدُ اليوم،
              // **حقيقةٌ عن المخزون لا عن المستند**، وشاشةُ الإنشاء ترسمه لكلّ
              // صفّ. **وهو اتّساقٌ مع الصفّ الحقيقيّ لا استثناءٌ عنه.**
              if (row.kind === 'filler') {
                return (
                  <RefRow key={`x-${row.product.id}`} data-view-filler={row.product.id}>
                    <RefTd>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {row.product.name}
                        {/* ⚠️ **الوسمُ يقول الصادقَ لا «بلا رصيد»** — تلك جملةٌ
                            عن المخزون، **وقد يكون للمنتج رصيدٌ وافرٌ اليوم.** */}
                        <RefTag>{t('products:documents.notInDocument')}</RefTag>
                      </span>
                    </RefTd>
                    <RefTd><StaticField /></RefTd>
                    <RefTd>—</RefTd>
                    <RefTd>
                      {t('products:orders.qtyWithUnit', {
                        n: stock.get(row.product.id) ?? 0, unit: unitOf(row.product),
                      })}
                    </RefTd>
                    <RefTd><StaticField /></RefTd>
                    <RefTd>—</RefTd>
                  </RefRow>
                )
              }

              // ── صفُّ المستند الحقيقيّ ───────────────────────────────
              const { line, product } = row
              const frames = movementFrames(line, product)
              // 🔴 **السعرُ المحفوظُ حرفيًّا** — `entered_unit_price` للعبوة.
              // ⚠️ **والعدمُ يبقى عدمًا:** `Number(null) === 0` كانت ستقول
              // «وصلت مجّانًا».
              const price = numberOrNull(line.entered_unit_price)
              // 🔴 **حسابٌ على نفس السطر — عمودان محفوظان** (الخيار ١)،
              // **وهو بعينه ضربُ شاشة الإنشاء** (`orderGrid.js:85`).
              const amount = price === null || frames.entered === null
                ? null
                : roundToPlaces(frames.entered * price)
              return (
                <RefRow key={line.id} data-view-line={line.id}>
                  {/* ⚠️ **الاسمُ قد يكون غيرَ محلولٍ** — منتجٌ حُذف من الكتالوج
                      وسطرُه باقٍ. **والشرطةُ تعني «الاسمُ غيرُ معروف» لا «لا
                      منتج»**، والسطرُ محفوظٌ بكلّ أرقامه. */}
                  <RefTd>{product?.name || '—'}</RefTd>

                  <RefTd>
                    <StaticField>
                      {frames.entered === null ? '' : frames.entered}
                    </StaticField>
                  </RefTd>
                  <RefTd>
                    {t('products:orders.qtyWithUnit', {
                      n: frames.base, unit: t(`products:units.${frames.baseUnit || 'pcs'}`),
                    })}
                  </RefTd>
                  <RefTd>
                    {t('products:orders.qtyWithUnit', {
                      n: stock.get(line.product_id) ?? 0,
                      unit: t(`products:units.${frames.baseUnit || 'pcs'}`),
                    })}
                  </RefTd>

                  <RefTd>
                    <StaticField>{price === null ? '' : price}</StaticField>
                  </RefTd>
                  <RefTd>
                    {amount === null ? '—' : amount.toLocaleString('ar', { maximumFractionDigits: 2 })}
                  </RefTd>
                </RefRow>
              )
            })}
            {viewRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="py-3 text-center text-xs text-muted-foreground">
                  {t('products:documents.noLines')}
                </td>
              </tr>
            )}
            <RefFillerRow columns={COLUMNS} />
          </tbody>
        </RefTable>
      </div>

      {/* ══ صفُّ البحث والضوابط الثلاثة — نفسُ المواضع، بلا وظيفة ══ */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5 text-muted-foreground" />
          <StaticField className="w-56 text-muted-foreground">
            {t('products:orders.searchPlaceholder')}
          </StaticField>
        </span>
        <StaticShellButton icon={Filter}>{t('products:orders.filterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileInput}>{t('products:orders.enterLabel')}</StaticShellButton>
        <StaticShellButton icon={FileSpreadsheet}>{t('products:orders.excelLabel')}</StaticShellButton>
      </div>

      {/* ══ المجموعُ والخصمُ والنقل — نفسُ الصفّ ونفسُ الترتيب ══ */}
      <div className="flex flex-wrap items-end gap-3 text-xs">
        {/* 🔴 موضعٌ وتسميةٌ دائمًا، وقيمةٌ «—» دائمًا (مجموعُ سطورٍ محظورٌ بـد/١). */}
        <span className="text-sm font-semibold">
          {t('products:orders.totalLabel')}{' '}
          <span data-view-total>—</span>
        </span>

        <span className="flex items-center gap-1.5">
          {t('products:supplyRef.discount')}
          <StaticField className="w-20">{discount === null ? '' : discount}</StaticField>
          <StaticSelect className="w-16">
            {t(`products:docs.discountKind_${doc.discount_kind || 'percent'}`)}
          </StaticSelect>
        </span>

        <span className="flex items-center gap-1.5">
          {t('products:supplyRef.transport')}
          <StaticField className="w-24">{transport === null ? '' : transport}</StaticField>
          <StaticSelect className="w-36">
            {t(`products:docs.transportPaidTo_${doc.transport_paid_to || 'supplier'}`)}
          </StaticSelect>
        </span>
      </div>

      {/* ══ الملاحظةُ — صندوقٌ ساكنٌ بارتفاع سطرين ══ */}
      <span className="flex flex-col gap-1 text-xs">
        {t('products:orders.noteLabel')}
        <StaticArea>{doc.note || ''}</StaticArea>
      </span>

      {/* ══ الذيلُ — مربّعُ التأشير يسارًا والأزرارُ الثلاثة يمينًا ══ */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-60">
          <StaticCheckbox />
          {t('products:supplyRef.changeRetailPrice')}
        </span>

        <div className="flex gap-2">
          <StaticCancelButton>{t('products:orders.backToFolders')}</StaticCancelButton>
          <StaticCancelButton>{t('products:orders.cancelButton')}</StaticCancelButton>
          <StaticActionButton>{t('products:supplyRef.toDebitButton')}</StaticActionButton>
        </div>
      </div>
    </div>
  )
}
