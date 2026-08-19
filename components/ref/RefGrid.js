// The dense grid.
//
// One primitive, two tones, and THE DISTINCTION IS STRUCTURAL WHILE THE COLOURS
// ARE NOT: one head says «a list you are reading» and the other «a sheet you
// are filling», so a reader knows what a table is before reading a cell of it.
// That two-way split is taken from the reference, where the catalogue and the
// invoice list are headed one way and the supply and order line grids another —
// sometimes inside the same window. Which two fills carry it is undecided, and
// both are placeholders in globals.css today.
//
// ⚠️ DENSE ON PURPOSE, AND THAT PART IS THE ASK. «Same information density» was
// named directly: a grid, not cards; many rows, not a few roomy ones. Every
// «let it breathe» edit to the padding or the font costs rows on screen, and
// somebody counting a shelf reads the difference as scrolling.
//
// 🔴 BUT THE EXACT ROW HEIGHT IS NOT THE ASK, and it was briefly treated as
// though it were: the reference's rows measure 18px and these were tuned to 19
// to match. That is a typography decision — and one taken off an ENGLISH
// reference for an ARABIC screen, where the same point size reads smaller.
// Density is the requirement; nineteen pixels is a guess wearing its clothes.

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

// A row of the body. `selected` marks the row the cursor is on — and it is a
// SEPARATE token from the write fill, which is the part that matters. The two
// mean opposite things: one says «I am looking at this», the other says «type
// here». In the reference they are a shade apart and easily confused; keeping
// them as two names means whatever is chosen for each, they cannot collapse
// into one by accident.
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
// 🔴 IT IS A HEADING AND NOTHING ELSE. ONE SPANNING CELL, NO WRITABLE CELL, AND
// THAT IS A DECISION RATHER THAN A SIMPLIFICATION.
//
// It was built with real cells, so that a group could carry a quantity of its
// own in the Packages column — type 50 on «منتجات الترطيب» and every product
// under it takes 50, which is what the reference does. The owner's answer:
//
//   «كل منتج ياخد كميته لحاله دايمًا. صف التصنيف ما لازم يكون فيه خانة كمية
//    قابلة للكتابة أصلاً — لأنه لو كتبت فيها بتصير سؤال هل هاي بتتوزع على
//    المنتجات تحتها، وهاد مش مطلوب.»
//
// ⚠️ AND THE SHAPE IS WHAT ENFORCES IT, NOT A RULE TO REMEMBER. A row of cells
// invites a `write` prop on one of them — it is one word away, it looks
// harmless, and the screen would then be asking a question nobody decided the
// answer to. A single spanning cell has nowhere to put it.
//
// ⚠️ Filled across the whole row rather than drawn as a thin strip above it,
// because that is the structural half («صفوف مجمّعة»). The fill itself is a
// placeholder — see design/TOKENS.md.
export function RefGroupRow({ columns, children, ...rest }) {
  return (
    <tr style={{ background: 'var(--group)' }} data-group-row {...rest}>
      <td
        colSpan={columns}
        className="px-1.5 py-[1px] font-semibold"
        style={{ borderBottom: '1px solid var(--rule)' }}
      >
        {children}
      </td>
    </tr>
  )
}

// A small square label beside a name — «طقم», «مؤرشف», «بمستودع كذا: ٩».
//
// ⚠️ NOT components/ui/badge. That one is a rounded pill, which is the
// product's look everywhere outside this region — and the content area is a
// complete replacement rather than a selective one. Same information, drawn the
// way everything else in here is drawn: square, flat, on the grid's own rule
// colour.
// ⚠️ **و`className` مدخلٌ اختياريٌّ بلا نبرةٍ افتراضيّةٍ جديدة:** «ملغى» يحتاج
// نبرةَ رفضٍ بينما «مؤرشف» لا، **والشكلُ واحدٌ في الحالتين.** فالنبرةُ وحدَها
// تُمرَّر، ولا يصير للوسم صنفان يتباعدان.
export function RefTag({ children, className = '' }) {
  return (
    <span className={`shrink-0 whitespace-nowrap border border-[var(--rule)] px-1 py-px text-[10px] leading-none text-muted-foreground ${className}`}>
      {children}
    </span>
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
