import { cn } from '@/lib/utils'

// The shell every control on the appointments toolbar wears.
//
// One row of equal-height cards rather than a row of buttons: each control
// carries a different amount of information — a count, a date, a shift, a
// bare label — and a card is the only shape that holds all four at the same
// height without any of them looking padded out to match the others.
//
// A class rather than a wrapper component, because half of these are triggers
// belonging to something else (a menu, a dialog) and would otherwise need a
// wrapper element each just to be given a border.
export const toolbarCard =
  'flex h-12 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 text-start'

// The same shell for something you can press.
export const toolbarCardButton = cn(
  toolbarCard,
  'transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
)

// A step-back / step-forward target inside a card, sized to the card's own
// height rather than to the glyph so the two arrows stay easy to hit.
export const toolbarArrow =
  'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60'

// What a control is, above what it currently says.
//
// The label is the quieter of the two on purpose: it never changes, so after
// the first read it is only there to say which card this is, while the value
// underneath is the part somebody is actually checking.
export function ToolbarStack({ label, value, className }) {
  return (
    <span className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
      <span className="truncate text-[13px] font-medium leading-none">{value}</span>
    </span>
  )
}

// A count riding on a card, in the one place a number is the point.
export function ToolbarCount({ children }) {
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-emerald-700">
      {children}
    </span>
  )
}
