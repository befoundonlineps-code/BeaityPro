import { useTranslation } from 'next-i18next'
import { FolderCog } from 'lucide-react'

// The band under the tab strip: where you are working, then what you can do.
//
// ⚠️ ITS BOTTOM RULE IS THE ORANGE, and that is the whole reason the band reads
// as chrome rather than as content. Without it the toolbar floats above the two
// panes as a third region; with it the tab strip and the toolbar close into one
// frame and everything below is the document.

// One entry: an icon over a label of one or two words, centred.
//
// ⚠️ Greyed, never hidden. A button that vanishes reads as a missing feature; a
// button that greys says «not from here» — and the control that would ungrey it
// is in the same band, two centimetres away. The reference does exactly this:
// picking «All storages» greys six of its ten buttons at once, which is the
// same rule as our navigationBlocked arriving at the same screen from the other
// side.
export function RefToolButton({ icon: IconComp, label, active, disabled, blockedTitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? blockedTitle : label}
      data-op-button={label}
      className={`flex h-[74px] w-[76px] shrink-0 flex-col items-center justify-start gap-1 px-1 pt-2 text-[11px] leading-tight ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-black/5'
      }`}
      style={active && !disabled ? { background: 'var(--chrome)', color: 'var(--chrome-ink)' } : undefined}
    >
      <IconComp className="size-7 shrink-0" strokeWidth={1.5} />
      <span className="text-center">{label}</span>
    </button>
  )
}

// The storage box: the picker, and the editor for the thing it picks.
//
// ⚠️ «Editing storages» LIVES HERE AND NOT IN THE ROW OF BUTTONS, because that
// is where the reference puts it — beside the list it edits rather than among
// the operations that move goods. It is the same modal either way; what changed
// is which question it sits under. Ours had it first in the toolbar, where it
// read as the first thing you do rather than as the maintenance of a field.
export function RefStorageBox({ label, children, onEditStorages, editLabel }) {
  return (
    <div className="flex shrink-0 flex-col justify-center gap-1 self-stretch border-e border-[var(--rule)] px-2 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
      <button
        type="button"
        onClick={onEditStorages}
        className="flex items-center gap-1 text-[11px] text-foreground hover:underline"
      >
        <FolderCog className="size-3.5" strokeWidth={1.5} />
        {editLabel}
      </button>
    </div>
  )
}

export default function RefToolbar({ children }) {
  return (
    <div
      className="flex w-full shrink-0 items-stretch overflow-x-auto bg-white"
      style={{ borderBottom: '2px solid var(--chrome)' }}
    >
      {children}
    </div>
  )
}

// A hairline between groups of buttons, as the reference draws between its
// blocks. Exported rather than inlined so a caller cannot invent a second
// spelling of the same line.
export function RefToolbarDivider() {
  return <div className="my-2 w-px shrink-0" style={{ background: 'var(--rule)' }} />
}

// The label the reference puts above its picker, translated once here so the
// two callers cannot drift.
export function useToolbarLabels() {
  const { t } = useTranslation(['products'])
  return {
    storage: t('products:lens.label'),
    editStorages: t('products:refShell.editStorages'),
  }
}
