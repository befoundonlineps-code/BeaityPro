import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { useTranslation } from 'next-i18next'
import { X } from 'lucide-react'

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

// Square corners, no rounding anywhere. The reference is a Windows application
// and every corner in it is a right angle; rounded corners on an orange title
// bar read as a web page imitating one rather than as the thing itself.
export default function RefModal({
  open, onClose, title, children, footer,
  // The reference sizes each modal to its content: the group picker is narrow,
  // the supply document is wide. A single width would make the picker a mostly
  // empty rectangle.
  width = 'max-w-[1100px]',
}) {
  const { t } = useTranslation('common')

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogPrimitive.Portal>
        {/* Barely there. The screen underneath must stay readable — that is the
            whole visual argument of the reference's modals. */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/5" />
        <DialogPrimitive.Popup
          data-ref-modal={title}
          // ⚠️ FOCUS LANDS ON THE PANEL, NOT ON THE CLOSE BUTTON — measured in
          // a real engine, where opening a modal drew a focus ring around the ×
          // in the orange bar. The first thing an operation says must not be
          // «cancel is selected»; and the trap still works, because the panel is
          // what base-ui returns to when Tab wraps.
          tabIndex={-1}
          className={`fixed start-1/2 top-6 z-50 flex max-h-[calc(100vh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 flex-col bg-white text-sm shadow-2xl outline-none rtl:translate-x-1/2 ${width}`}
          style={{
            border: '1px solid var(--chrome)',
            // 🔴 THE ORANGE ACTION BUTTON, WITHOUT REWIRING TEN SCREENS.
            //
            // Every operation already ends in one primary button — «سجّل
            // التوريد», «احفظ الجرد» — sitting at the bottom of its own form,
            // which is where the reference puts its «To debit» too. What it was
            // not, was orange. Re-parenting each of those into a modal footer
            // means a render prop threaded through ten components, each of
            // which would then have TWO ways to submit for as long as the
            // conversion took.
            //
            // ⇒ The variable is redefined for this subtree instead, so
            // `bg-primary` resolves to the chrome orange inside a modal and to
            // the app's blue everywhere else. One declaration, no component
            // touched, and it cannot fall out of step because there is nothing
            // to keep in step.
            //
            // ⚠️ `--color-*` AND NOT `--primary`. Tailwind v4's `@theme inline`
            // declares `--color-primary: var(--primary)` ON :root, so the
            // substitution happens there and descendants inherit the finished
            // colour — overriding `--primary` here would change nothing at all,
            // silently. Measured in a real engine rather than reasoned: the
            // post button's computed background reads rgb(254, 162, 15).
            '--color-primary': 'var(--chrome)',
            '--color-primary-foreground': 'var(--chrome-ink)',
            '--color-ring': 'var(--chrome)',
          }}
        >
          {/* ── The orange header ─────────────────────────────────────── */}
          <div
            className="flex shrink-0 items-center justify-between gap-2 px-2 py-1"
            style={{ background: 'var(--chrome)', color: 'var(--chrome-ink)' }}
          >
            <DialogPrimitive.Title className="truncate text-xs font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="flex size-5 shrink-0 items-center justify-center hover:bg-black/10"
              aria-label={t('common:close')}
            >
              <X className="size-3.5" />
            </DialogPrimitive.Close>
          </div>

          {/* ── The body ──────────────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>

          {/* ── Cancel, then the orange one ───────────────────────────── */}
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

// The one orange button an operation ends with. There is exactly one per modal
// in the reference — «To order», «To debit», «Select» — and it is the only
// orange thing in the body.
//
// ⚠️ Which is why it is a component rather than a class string: an orange
// button that appears twice stops meaning «this is the act».
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

export function RefCancelButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 min-w-[100px] border border-[var(--rule)] bg-white px-4 text-xs hover:bg-black/5"
    >
      {children}
    </button>
  )
}
