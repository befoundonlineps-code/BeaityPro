import { sectionTab, sectionQuery } from './sectionTabs'

// The products section's tabs. The rule they follow — what belongs in the URL
// and what belongs in component state — is in lib/sectionTabs.js, which every
// section now shares.
export const DOCUMENT_VIEWS = ['supply', 'write_off', 'return_to_supplier', 'transfer']

// ⚠️ `stocktake` is NOT in DOCUMENT_VIEWS, and that is the same boundary
// stockDocumentForm keeps: it sends counts rather than movements, and its own
// function works the difference out under a lock. Folding it into the shared
// document screen would make `rows` mean two different things.
// ⚠️ `orders` is NOT in DOCUMENT_VIEWS either, and for a sharper reason than
// the stocktake's: an order writes no movement at all. It is a template that a
// supply is filled FROM, so folding it into the document screen would put a
// storage, a cost and a posting button on a thing that moves nothing.
export const VIEWS = ['catalog', 'storages', 'suppliers', 'orders', ...DOCUMENT_VIEWS, 'stocktake', 'coverage', 'documents', 'balances']

// 🔴 الشاشاتُ التي حُوِّلت إلى شكل المرجعيّة ولها مكوّنُها الخاصّ.
//
// تكبر واحدةً واحدة حتى تبتلع `DOCUMENT_VIEWS` كلَّها، **وعندها وحدَها يُحذف
// `StockDocumentScreen`** — لا قبل.
//
// ⚠️ **وهي موجودةٌ لأن الشاشةَ المشتركةَ شاشاتٌ كثيرة.** `StockDocumentScreen`
// يخدم أربعَ عمليّاتٍ خلف `docType`، فتحويلُ واحدةٍ منها لا يعني استبدالَه —
// والثلاثُ الباقياتُ تنكسر بصمتٍ لو انسحب من تحتهنّ. فالتوجيهُ يُشتقّ من هذه
// القائمة بدل استثناءٍ يُكتب بيدٍ في الصفحة، **لأن الاستثناءَ المكتوبَ بيدٍ يفشل
// مفتوحًا: شاشةٌ تسقط من القائمتين معًا لا يرسمها أحدٌ ولا شيءَ يشتكي.**
export const REFERENCE_FORM_VIEWS = ['orders', 'supply']

export function usesReferenceForm(view) {
  return REFERENCE_FORM_VIEWS.includes(view)
}

// أيُّ العمليّاتِ ما زالت على الشاشة المشتركة — مشتقّةٌ لا مسرودة.
export function usesSharedDocumentScreen(view) {
  return isDocumentView(view) && !usesReferenceForm(view)
}

export function productsView(tab) {
  return sectionTab(VIEWS, tab)
}

// ⚠️ `extra` is passed straight through to sectionQuery, which has carried it
// since it was written: a query parameter that is not the tab must survive a
// tab change, or switching quietly throws away what the address was holding.
// The products screen is the first caller to use it, and what it holds is the
// open operation — `?op=supply`.
export function productsQuery(view, extra = {}) {
  return sectionQuery(VIEWS, view, { extra })
}

// The four views that are one screen with a doc type rather than four screens.
export function isDocumentView(view) {
  return DOCUMENT_VIEWS.includes(view)
}
