import { useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useTranslation } from 'next-i18next'
import { X } from 'lucide-react'
import RefChromeBar, { CHROME_TITLE, CHROME_CLOSE } from './RefChromeBar'

// An operation, drawn over the screen it operates on.
//
// 🔴 BUILT ON base-ui DIRECTLY RATHER THAN ON components/ui/dialog.jsx, and the
// reason is one line of that file: its overlay is `bg-black/10` with a
// backdrop-blur, hard-coded inside DialogContent with no way through. The
// reference does not dim and does not blur — the catalogue behind the modal
// stays readable, and in the invoices screenshot you can still read the tree
// and the grid headings underneath. That is not decoration: it is what makes a
// modal read as «over the products screen» rather than as «instead of it».
//
// ⇒ Reaching that through the shared primitive would mean giving 34 other
// callers a new prop and a new default. Same trade as RefTopBar: the shared
// component is left alone and this one is honest about being a second.
//
// ⚠️ What is NOT re-implemented: the focus trap, the escape key, the portal and
// the scroll lock all come from base-ui, which is what components/ui/dialog.jsx
// is built on too. This is a different skin on the same machine, not a second
// machine.

// 🔴 THE SQUARE CORNERS ARE NOT A DECISION ANYBODY TOOK, AND THIS COMMENT USED
// TO ARGUE THAT THEY WERE.
//
// It read: «the reference is a Windows application and every corner in it is a
// right angle; rounded corners read as a web page imitating one rather than as
// the thing itself.» That is not an argument — it is a preference in the
// costume of a principle, and it is more dangerous than the palette was,
// because a colour looks like a choice and a corner radius looks like physics.
//
// ⇒ Zero radius is a PLACEHOLDER too, and it sits with the rest of the open
// list in design/TOKENS.md. What is structural here is that an operation opens
// OVER the screen it operates on rather than replacing it — the catalogue stays
// readable underneath, so nobody loses their place to fill in a form. The
// corners, the shadow and how much the backdrop dims are all still open.
export default function RefModal({
  open, onClose, title, children, footer,
  // Each operation opens at the size of what is in it — the storages list is
  // narrow, a supply document is as wide as its grid. THAT is structural; the
  // particular pixel counts below are not.
  width = 'max-w-[1100px]',
}) {
  const { t } = useTranslation('common')
  const panel = useRef(null)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogPrimitive.Portal>
        {/* Barely there. The screen underneath must stay readable — that is the
            whole visual argument of the reference's modals. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/5" />
        <DialogPrimitive.Popup
          ref={panel}
          data-ref-modal={title}
          // 🔴 FOCUS LANDS ON THE PANEL, NOT ON THE CLOSE BUTTON — and the first
          // attempt at this DID NOT WORK while a comment here said it had.
          //
          // Opening a modal drew a focus ring round the × in the header bar, so
          // `tabIndex={-1}` was added on the theory that base-ui would prefer a
          // focusable popup. It does not: it takes the first tabbable
          // descendant unless told otherwise. Re-measured — `document
          // .activeElement` came back as the close button, aria-label «إغلاق»,
          // with a live outline — which is the whole reason to read the engine
          // instead of the reasoning.
          //
          // ⇒ `initialFocus` is the actual API, and it takes the ref. The trap
          // is untouched; only where it starts moved. The first thing an
          // operation says must not be «cancel is selected».
          tabIndex={-1}
          initialFocus={panel}
          className={`fixed start-1/2 top-6 z-50 flex max-h-[calc(100vh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 flex-col bg-white text-sm shadow-2xl outline-none rtl:translate-x-1/2 ${width}`}
          style={{
            border: '1px solid var(--chrome)',
            // 🔴 THE ACTION BUTTON TAKES THE CHROME COLOUR, WITHOUT REWIRING
            // TEN SCREENS.
            //
            // Every operation already ends in one primary button — «سجّل
            // التوريد», «احفظ الجرد» — sitting at the bottom of its own form,
            // which is where the reference puts its «To debit» too. What it was
            // not, was distinguished from the buttons beside it. Re-parenting each
            // means a render prop threaded through ten components, each of
            // which would then have TWO ways to submit for as long as the
            // conversion took.
            //
            // ⇒ The variable is redefined for this subtree instead, so
            // `bg-primary` resolves to the chrome token inside a modal and to
            // the app's own primary everywhere else. One declaration, no
            // component touched, and it cannot fall out of step because there
            // is nothing to keep in step.
            //
            // ⚠️ `--color-*` AND NOT `--primary`. Tailwind v4's `@theme inline`
            // declares `--color-primary: var(--primary)` ON :root, so the
            // substitution happens there and descendants inherit the finished
            // colour — overriding `--primary` here would change nothing at all,
            // silently. Measured in a real engine rather than reasoned: the
            // computed background inside a modal reads back as the chrome
            // token's current value and not the app's primary.
            '--color-primary': 'var(--chrome)',
            '--color-primary-foreground': 'var(--chrome-ink)',
            '--color-ring': 'var(--chrome)',
          }}
        >
          {/* ── The header bar ────────────────────────────────────────── */}
          {/* 🔴 الشكلُ وحدَه انتقل إلى `RefChromeBar` كي يستعيره لوحُ عرض
              المستندات — **والآليّةُ باقيةٌ هنا كما كانت حرفًا بحرف:**
              `DialogPrimitive.Title` يبقى هو عقدةَ العنوان (وعليه يقوم ربطُ
              `aria-labelledby`)، و`DialogPrimitive.Close` يبقى هو الزرّ.
              ⚠️ **ولو ابتلع الشريطُ العقدتين لتغيّر سلوكُ عشر عمليّاتٍ قائمة**،
              وذلك ما اشترط المالكُ ألّا يقع. */}
          <RefChromeBar
            title={(
              <DialogPrimitive.Title className={CHROME_TITLE}>
                {title}
              </DialogPrimitive.Title>
            )}
            close={(
              <DialogPrimitive.Close
                className={CHROME_CLOSE}
                aria-label={t('common:close')}
              >
                <X className="size-3.5" />
              </DialogPrimitive.Close>
            )}
          />

          {/* ── The body ──────────────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>

          {/* ── Cancel, then the one that acts ────────────────────────── */}
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--rule)] px-3 py-2">
              {footer}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// The ONE button an operation ends with. There is exactly one per modal
// in the reference — «To order», «To debit», «Select» — and it is the only
// thing in the body carrying the chrome token.
//
// ⚠️ Which is why it is a component rather than a class string: a second one
// on the same screen stops it meaning «this is the act».
export function RefActionButton({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-ref-action
      className="h-8 min-w-[120px] px-4 text-xs font-semibold disabled:opacity-40"
      style={{ background: 'var(--chrome)', color: 'var(--chrome-ink)' }}
    >
      {children}
    </button>
  )
}

// 🔴 **كان يبتلع كلَّ خاصّيّةٍ عدا `children` و`onClick` — بصمت.**
//
// ⚠️ **وقع فعلًا ومُدمجٌ في `main`:** زرُّ «إلغاء» في ورقة الجرد كُتب له
// `title={t('…cancelHelp')}` **ليقول إن العدَّ يبقى محفوظًا** — وهو النصُّ الذي
// حُسم به قرارُ المالك بين «إغلاق» و«رمي». **ولم يصل الشاشةَ قطّ.**
//
// **ولا شيءَ يشتكي:** لا خطأ، ولا تحذيرَ React، **وخاصّيّةٌ تُمرَّر إلى مكوّنٍ
// لا يقرؤها تختفي كما لو لم تُكتب** — وهو أخو «خاصّيّةٌ لم تُمرَّر تصل
// `undefined`»، بالاتّجاه المعاكس.
//
// ⇒ **والباقي يُمرَّر** (`...rest`)، فـ`title` و`data-*` تصل الوسمَ فعلًا.
// **و`className` تُدمج ولا تُستبدَل**، وإلّا صار تمريرُها يمحو شكلَ الزرّ.
export function RefCancelButton({ children, onClick, className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 min-w-[100px] border border-[var(--rule)] bg-white px-4 text-xs hover:bg-black/5 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
