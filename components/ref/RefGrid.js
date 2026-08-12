// The dense grid.
//
// One primitive, two tones, and the tone is the sentence: a GREY head means «a
// list you are reading» and an ORANGE head means «a sheet you are filling».
// Measured, not chosen — the catalogue and the invoice list carry grey heads in
// the reference, and the supply and order line grids carry orange, in the same
// screenshots and sometimes in the same window.
//
// ⚠️ AND IT IS DENSE ON PURPOSE, WHICH IS THE PART THAT IS EASY TO UNDO. Row
// height is set by a small padding and a small font, and every «let it breathe»
// edit to either one costs rows on the screen. The reference fits about thirty
// products in the height ours fits twelve, and somebody counting a shelf reads
// the difference as scrolling.

// The table itself.
//
// ⚠️ `height: 100%` IS LOAD-BEARING AND LOOKS LIKE TIDINESS. It is what gives
// the filler row slack to absorb, which is what carries the column rules down
// through the empty area. The first version wrote `height: 1px` — the usual
// idiom for making a CELL fill its row — and measured: the rules stopped dead
// at the last product, exactly the white rectangle this was meant to remove.
export function RefTable({ children, className = '' }) {
  return (
    <table className={`w-full border-collapse text-xs ${className}`} style={{ height: '100%' }}>
      {children}
    </table>
  )
}

const HEAD_TONE = {
  list: { background: 'var(--grid-head)', color: 'inherit', borderBottom: '1px solid var(--grid-head-rule)' },
  entry: { background: 'var(--chrome)', color: 'var(--chrome-ink)', borderBottom: '1px solid var(--chrome)' },
}

export function RefHead({ tone = 'list', children }) {
  return (
    <thead
      className="sticky top-0 z-10"
      style={HEAD_TONE[tone] || HEAD_TONE.list}
      data-grid-tone={tone}
    >
      {children}
    </thead>
  )
}

export function RefTh({ children, className = '', ...rest }) {
  return (
    <th
      className={`whitespace-nowrap px-1.5 py-1 text-start font-semibold ${className}`}
      style={{ borderInlineEnd: '1px solid var(--rule)' }}
      {...rest}
    >
      {children}
    </th>
  )
}

// A row of the body. `selected` is the pale cyan the reference puts under the
// row the cursor is on — and it is NOT the write blue. Those two are a shade
// apart and mean opposite things: one says «I am looking at this», the other
// says «type here».
export function RefRow({ selected, onClick, children, className = '', ...rest }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={selected ? { background: 'var(--pick)' } : undefined}
      {...rest}
    >
      {children}
    </tr>
  )
}

export function RefTd({ children, className = '', write, ...rest }) {
  return (
    <td
      className={`px-1.5 py-[1px] align-middle ${className}`}
      style={{
        borderInlineEnd: '1px solid var(--rule)',
        borderBottom: '1px solid var(--rule)',
        // ⚠️ The one place --write is allowed: a cell somebody types into.
        ...(write ? { background: 'var(--write)' } : null),
      }}
      {...rest}
    >
      {children}
    </td>
  )
}

// A group heading INSIDE the grid — a folder gathering the rows under it.
//
// ⚠️ Yellow across the whole row, not a grey strip. And it keeps its cells
// rather than spanning them, because in the reference a group row carries a
// value of its own in the Packages column: fill it once and every child takes
// it. A colSpan row cannot ever grow that, and the day it is needed the row
// would have to be rebuilt under whoever is using it.
export function RefGroupRow({ children, ...rest }) {
  return (
    <tr style={{ background: 'var(--group)' }} data-group-row {...rest}>
      {children}
    </tr>
  )
}

export function RefGroupTd({ children, className = '', ...rest }) {
  return (
    <td
      className={`px-1.5 py-[1px] font-semibold ${className}`}
      style={{ borderInlineEnd: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
      {...rest}
    >
      {children}
    </td>
  )
}

// 🔴 THE EMPTY AREA KEEPS ITS COLUMNS, and this row is the whole mechanism.
//
// In the reference the column rules run to the bottom of the pane whether there
// are three rows or none — which is what makes an empty grid read as an empty
// GRID. Ours stopped at the last row, so a salon with no products yet, or a
// folder with nothing in it, saw a white rectangle: the same picture a screen
// that failed to load shows.
//
// ⚠️ It is `aria-hidden` and holds no text, because it is a ruled background
// drawn with table cells. A screen reader that announced n empty cells here
// would be reading the paper rather than the writing.
export function RefFillerRow({ columns }) {
  return (
    <tr aria-hidden="true" style={{ height: '100%' }} data-filler-row>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} style={{ borderInlineEnd: '1px solid var(--rule)' }} />
      ))}
    </tr>
  )
}
