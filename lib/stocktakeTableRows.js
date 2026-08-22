import { orderFolderRows, allSelectableIds } from './orderFolderPick'
import { periodMovement, planOf } from './stocktakePeriod'
import { costPerBaseUnit } from './stocktakeMoney'
import { costIsEstimated } from './balanceView'

// صفوفُ جدول الجرد — مجلّدٌ ثمّ منتجاتُه، بشكل الشاشة المرجعيّة.
//
// ⚠️ **والمرجعُ هنا كتالوجُ المستودع لا سطورُ مستند** — الجردُ يسأل «ما الذي
// يجب أن يُعدَّ على هذا الرفّ»، **فالمنتجُ يظهر ولو لم تكن له حركةٌ قطّ.**
// وهو عكسُ شاشات العرض حيث سطرُ المستند هو المرجع.

/**
 * حالةُ تكلفة الوحدة — **ثلاثٌ لا اثنتان.**
 *
 * 🔴 **والتمييزُ بين الأخيرتين هو ما يمنع إيهامًا:** «تقديريّ» تعني **جرى
 * حسابٌ واستُعمل بديل**، و«لم يتحرّك قطّ» تعني **لا معلومةَ إطلاقًا.** ووسمٌ
 * واحدٌ عليهما يقول لصاحب المحلّ إن حسابًا جرى حيث لم يجرِ شيء.
 *
 * ⚠️ **ومقيسٌ من تعريف الـview** (`043-cost-estimated.sql:156`): `GROUP BY`
 * على `stock_movements` ⇒ **منتجٌ بلا حركةٍ لا يُنتج صفًّا إطلاقًا**، ومنتجٌ
 * رصيدُه ≤ ٠ يُنتج صفًّا بـ`avg_cost = null`.
 */
export const COST_STATE = {
  KNOWN: 'known',
  ESTIMATED: 'estimated',
  NO_BALANCE_HERE: 'noBalanceHere',
  NEVER_MOVED: 'neverMoved',
}

export function costStateOf(balanceRow) {
  if (!balanceRow) return COST_STATE.NEVER_MOVED
  if (costPerBaseUnit(balanceRow) === null) return COST_STATE.NO_BALANCE_HERE
  return costIsEstimated(balanceRow) ? COST_STATE.ESTIMATED : COST_STATE.KNOWN
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'ar')

/**
 * صفوفُ الجدول: `folder` ثمّ `line` لكلّ منتجٍ فيه.
 *
 * ⚠️ **والمؤرشَفُ يُعرض إن كان له رصيدٌ هنا** — «مؤرشَف» تعني «لا تشترِ منه»
 * لا «الرفُّ فارغ»، **والجردُ الذي لا يعدّه يقول «عددتُ هذا المستودع» وهي
 * غيرُ صحيحةٍ بالبناء.** وهي نفسُ قاعدة `balanceRows` حرفًا.
 *
 * ⚠️ **ولا صفَّ حشوٍ هنا ولا مجموعةَ يتامى** — بخلاف شاشات العرض: هناك
 * المرجعُ مستندٌ ماضٍ قد يحمل منتجًا خرج من الكتالوج، **وهنا المرجعُ كتالوجُ
 * اليوم نفسُه، فلا شيءَ خارجَه يُعدّ.**
 */
export function stocktakeTableRows({
  categories, storageCategories, storageId, products, balances,
  movements, documents, since, counts,
} = {}) {
  const { rows: period, unknownTypes, unreadableQuantities } = periodMovement({
    movements, documents, storageId, since,
  })

  const balanceByProduct = new Map()
  for (const row of balances || []) {
    if (row && row.storage_id === storageId) balanceByProduct.set(row.product_id, row)
  }

  const folders = orderFolderRows({ categories, storageId, links: storageCategories })
  const selectable = new Set(allSelectableIds(folders))
  const typed = counts || {}
  const out = []

  for (const folder of folders) {
    if (!selectable.has(folder.id)) continue

    const own = (products || [])
      .filter((p) => {
        if (!p || p.category_id !== folder.id) return false
        const balance = balanceByProduct.get(p.id)
        const hasStock = balance && Number(balance.balance_base) !== 0
        return p.is_active !== false || hasStock
      })
      .sort(byName)

    out.push({
      kind: 'folder', id: folder.id, name: folder.name, depth: folder.depth, childCount: own.length,
    })

    for (const product of own) {
      const movement = period.get(product.id) || null
      const balance = balanceByProduct.get(product.id) || null
      out.push({
        kind: 'line',
        product,
        movement,
        plan: planOf(movement),
        cost: costPerBaseUnit(balance),
        costState: costStateOf(balance),
        // ⚠️ **الخانةُ نصٌّ لا رقم** — «لم تُملأ بعد» و«صفرٌ معدود» حالتان
        // مختلفتان، **و`Number('')` يجعلهما واحدة.**
        fact: Object.prototype.hasOwnProperty.call(typed, product.id) ? typed[product.id] : '',
      })
    }
  }

  return { rows: out, unknownTypes, unreadableQuantities }
}
