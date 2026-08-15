import { useTranslation } from 'next-i18next'

// 🔴 THE COLOURS IN THE CONVERTED AREA ARE NOT DECIDED, AND THE SCREEN SAYS SO.
//
// Every value the reference-styled grid, tree and modal read from globals.css
// is a neutral standing in for a colour nobody has chosen. That was not always
// true: a palette measured off the reference screenshots was deposited as
// though it were settled, when what was asked for was the STRUCTURE — the tree,
// the dense grid, the modal per operation. A correct measurement, entered as a
// decision that was never taken.
//
// ⚠️ Which is exactly why a comment in the code is not enough. A neutral screen
// still looks like SOMEBODY'S neutral screen, and whoever opens it — the owner
// comparing it against the reference first of all — has no way to tell a
// placeholder from a choice.
//
// ⚠️ AND IT LIVES BESIDE THE BREADCRUMB, NOT IN THE TOP BAR. It sat in the top
// bar while that bar was part of the conversion; the bar is the product's own
// again, so a badge in it would be claiming something about a region that is
// already decided. What is undecided is everything from the tree downwards, and
// this sits at the line between them.
//
// ⇒ Removed by flipping the flag, on the day the colours are settled in the
// separate conversation they belong to. One line, one place.
export const PROVISIONAL_PALETTE = true

export default function ProvisionalPaletteBadge() {
  const { t } = useTranslation('common')
  if (!PROVISIONAL_PALETTE) return null

  return (
    <span
      data-provisional-palette
      title={t('common:provisionalPaletteHint')}
      className="shrink-0 cursor-help border border-dashed border-muted-foreground/50 px-1.5 py-px text-[10px] text-muted-foreground"
    >
      {t('common:provisionalPalette')}
    </span>
  )
}
