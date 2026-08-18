import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// الدفعاتُ وحركاتُها — ما يحتاجه عمودُ «الدفعة» في شاشة الشطب.
//
// 🔴 **قراءتان لا واحدة، لأن المتبقّي ليس عمودًا.** `stock_lots` تقول ما وُلد،
// و`stock_movements` تقول ما دخل وخرج، **والمتبقّي مجموعُ الثانية على `lot_id`**
// (ADR-051، و٠٩٤ يشرح لماذا لا يوجد عمودٌ مخزَّنٌ له).
//
// ⚠️ **والحسابُ نفسُه يقع في `lib/lotPicker.js`** بنفس صيغة `draw_stock_from_lots`
// — فالشاشةُ تعرض متبقّيًا والقاعدةُ ترفض على متبقٍّ، **ولو اختلف الحسابان لعرضت
// الشاشةُ «١٢ متاح» ورُفض عند ١٠ بلا تفسير.**
//
// ⚠️ **و`error` يُحفظ ولا يُبتلع** — البند ٢٦، وهو أحدُّ هنا منه في أيِّ مكان:
// **قائمةُ دفعاتٍ فارغةٌ تعني «هذا المنتج لا يُشطب»** وتُعطِّل الخانة. فقراءةٌ
// فشلت وعُرضت فراغًا **لا تفشل — بل تُطمئن**، ويقرأ الناظرُ «بلا رصيد» عن
// مستودعٍ مليء.
//
// ⚠️ **ولا تصفيةَ بالمستودع في الاستعلام:** الشاشةُ تبدّل العدسةَ بلا إعادة جلب،
// **والتصفيةُ تقع في `lotsForLine` بالمستودع والمنتج معًا** — نفسُ قرار
// `useProductBalances` ولنفس السبب.
export function useStockLots() {
  const [lots, setLots] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const lotsRead = await supabase
        .from('stock_lots')
        // 🔴 **`source_document_id` غاب مرّةً، والعطلُ صامتٌ تمامًا:** الدفعةُ تصل
        // بلا حقلٍ، فـ`wanted.has(undefined)` ترجع `false` على كلّ صفّ — **فلا
        // يُملأ شيءٌ عند اختيار فاتورة، ولا خطأَ ولا سطرَ يشتكي.**
        //
        // ⚠️ **وسردُ الأعمدة هو الوحيدُ الذي يقرّر ما يصل**، والكودُ الذي يقرأ
        // الحقلَ لا يعرف أنه لم يُطلَب. **فحارسٌ يقابل الاثنين في
        // `lib/writeOffFromInvoice.test.js`.**
        .select('id, salon_id, storage_id, product_id, source_document_id, unit_cost, cost_is_estimated, received_at, created_at')
      if (lotsRead.error) {
        setError(lotsRead.error)
        return
      }

      // ⚠️ **`lot_id` و`quantity_base` وحدَهما.** الحركةُ تحمل أعمدةً كثيرةً لا
      // يحتاجها المتبقّي، **وجلبُ السجلّ كلِّه لحساب مجموعٍ يكبر بلا حدٍّ مع
      // عمر الصالون.**
      const movesRead = await supabase
        .from('stock_movements')
        .select('lot_id, quantity_base')
      if (movesRead.error) {
        setError(movesRead.error)
        return
      }

      setError(null)
      setLots(lotsRead.data || [])
      setMovements(movesRead.data || [])
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { lots, movements, loading, error, reload: load }
}
