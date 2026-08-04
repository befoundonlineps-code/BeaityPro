import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Minus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// A toolbar button: an icon over a word, the same shape the reference screen
// uses and the same one the clients bar already uses in this app.
export function ToolButton({ icon: Icon, label, disabled, onClick }) {
  return (
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClick}>
      <Icon />
      {label}
    </Button>
  )
}

// One row of the folder tree. Folders open and close on their own button so
// that selecting a folder and opening it stay two different acts — picking a
// folder to add something to should not force its contents open.
//
// Archiving is inherited downwards: a child of an archived folder is drawn
// archived whatever its own flag says, which is the same rule
// lib/categoryVisibility.js resolves by walking up.
function TreeRow({ node, depth, expanded, onToggle, selectedId, onSelect, archived, archivedLabel }) {
  const hasChildren = (node.children || []).length > 0
  const open = expanded.has(node.id)
  const selected = selectedId === node.id

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}
        style={{ paddingInlineStart: `${depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded border border-border text-muted-foreground"
          >
            {open ? <Minus className="size-2.5" /> : <Plus className="size-2.5" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={`min-w-0 flex-1 truncate px-1 py-1.5 text-start text-sm ${
            selected ? 'font-medium text-primary' : ''
          } ${archived ? 'text-muted-foreground line-through' : ''}`}
        >
          {node.name}
        </button>

        {archived && <Badge variant="outline" className="shrink-0">{archivedLabel}</Badge>}
      </div>

      {open && (node.children || []).map((sub) => (
        <TreeRow
          key={sub.id}
          node={sub}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
          archived={archived || sub.is_active === false}
          archivedLabel={archivedLabel}
        />
      ))}
    </div>
  )
}

// Folders on one side, what is in the selected one on the other.
//
// Extracted from ServicesBrowser when a second screen needed the same shape,
// not before: an abstraction shaped by one example is usually the wrong
// abstraction. What it carries is the part that was expensive to get right —
// the recursive rows, the inherited archiving, and the loading overlay that
// ADR-048 exists for.
//
// It owns exactly one piece of state, `expanded`, because nothing above it
// ever reads which folders are open. Everything the screen needs to filter or
// enable buttons — the selected folder, the search text — stays with the
// screen, where it already was.
//
// ⚠️ Loading is drawn over this, never instead of it. Returning a different
// element while loading is what unmounted the screen and threw away the
// selected folder, the open branches and the search box (ADR-048).
export default function TwoPaneBrowser({
  loading = false,
  tree,
  isArchived,
  archivedLabel,
  selectedCategoryId,
  onSelectCategory,
  treeToolbar,
  treeEmpty,
  itemsToolbar,
  search,
  onSearchChange,
  searchPlaceholder,
  pickCategoryHint,
  children,
}) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(() => new Set())

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const roots = tree || []

  return (
    <div
      className="relative flex min-h-0 flex-col gap-3 lg:h-[calc(100vh-15rem)] lg:flex-row"
      aria-busy={loading}
    >
      {/* Said over the screen rather than instead of it. Instead of it was
          the bug: a different element here means React takes this one down,
          and everything chosen on it goes with it. It does not swallow
          clicks — the catalogue arriving is no reason to freeze the folder
          you were about to open. */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/40 pt-10">
          <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
            {t('common:loading')}
          </span>
        </div>
      )}

      {/* ── The folders ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col rounded-xl border border-border lg:w-80">
        {/* Rendered only when there is something to put in it. A screen with
            no folder actions yet would otherwise get an empty bordered strip
            that reads as a broken toolbar rather than an absent one. */}
        {treeToolbar && (
          <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-1 py-1">
            {treeToolbar}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {roots.length === 0 && treeEmpty
            ? treeEmpty
            : roots.map((root) => (
                <TreeRow
                  key={root.id}
                  node={root}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggle}
                  selectedId={selectedCategoryId}
                  onSelect={onSelectCategory}
                  archived={isArchived ? isArchived(root) : root.is_active === false}
                  archivedLabel={archivedLabel}
                />
              ))}
        </div>
      </div>

      {/* ── What is in the selected one ───────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border">
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
          {itemsToolbar}

          <div className="relative ms-auto w-56">
            <Search className="pointer-events-none absolute inset-y-0 end-2 my-auto size-3.5 text-muted-foreground" />
            <Input
              className="pe-7"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        {!selectedCategoryId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {pickCategoryHint}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        )}
      </div>
    </div>
  )
}
