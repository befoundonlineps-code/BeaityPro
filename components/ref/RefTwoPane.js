import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Folder, FolderOpen, Minus, Plus } from 'lucide-react'

// Folders on one side, what is in them on the other — in the reference's
// proportions rather than ours.
//
// ⚠️ A SECOND COMPONENT BESIDE TwoPaneBrowser, NOT A RESTYLE OF IT. That one is
// rendered by the services screen too, and restyling it would convert a screen
// nobody asked about, in the same commit, with no way to judge the two apart.
// Same trade as RefTopBar, same expiry: when the model is approved, the
// services screen moves here and TwoPaneBrowser goes.
//
// 🔴 AND THE ROOT NODE IS NOT DECORATION. The reference's tree begins with
// «Products (Storage 'Cosmotology Storge')» above the folders, and selecting it
// is how you ask for everything. Ours had that state — no folder chosen means
// every product — and NOTHING ON SCREEN SAID SO: the tree simply had nothing
// highlighted, which reads as «not loaded yet» rather than as «all of them».
// The reference gives the state a row, a name and a highlight.
//
// ⚠️ And the root's label carries the storage, which is the second thing it
// does: the grid below it shows a balance that changes with the picker, so the
// tree says out loud which storage the numbers belong to. That is the grain
// riding along with the number, in the one place a reader cannot miss it.

function TreeRow({ node, depth, expanded, onToggle, selectedId, onSelect, archived, archivedLabel }) {
  const hasChildren = (node.children || []).length > 0
  const open = expanded.has(node.id)
  const selected = selectedId === node.id

  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={node.name}
            className="flex size-3.5 shrink-0 items-center justify-center border border-[var(--rule)] bg-white text-muted-foreground"
          >
            {open ? <Minus className="size-2" /> : <Plus className="size-2" />}
          </button>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          data-tree-node={node.id}
          className={`flex min-w-0 flex-1 items-center gap-1.5 truncate px-1 py-[3px] text-start text-xs ${
            archived ? 'line-through opacity-60' : ''
          }`}
          style={selected ? { background: 'var(--chrome)', color: 'var(--chrome-ink)' } : undefined}
        >
          {open ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
          <span className="truncate">{node.name}</span>
          {archived && <span className="shrink-0 opacity-70">({archivedLabel})</span>}
        </button>
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

export default function RefTwoPane({
  loading = false,
  tree,
  isArchived,
  archivedLabel,
  rootLabel,
  selectedCategoryId,
  onSelectCategory,
  treeToolbar,
  treeEmpty,
  itemsToolbar,
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
    <div className="relative flex min-h-0 flex-1 items-stretch" aria-busy={loading}>
      {/* ⚠️ Over the panes, never instead of them — ADR-048. Swapping the
          element out on load is what threw away the chosen folder, the open
          branches and the search box. */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-8">
          <span className="border border-[var(--rule)] bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm">
            {t('common:loading')}
          </span>
        </div>
      )}

      {/* ── The folders ───────────────────────────────────────────────── */}
      <div className="flex w-[360px] shrink-0 flex-col border-e border-[var(--rule)] bg-white">
        {treeToolbar && (
          <div className="flex shrink-0 items-center gap-1 border-b border-[var(--rule)] px-1 py-0.5">
            {treeToolbar}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto py-1">
          {/* The root: «everything», named, and carrying the storage the
              numbers below belong to. */}
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            data-tree-node="__root__"
            className="flex w-full items-center gap-1.5 px-2 py-[3px] text-start text-xs"
            style={selectedCategoryId ? undefined : { background: 'var(--chrome)', color: 'var(--chrome-ink)' }}
          >
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate">{rootLabel}</span>
          </button>

          {roots.length === 0 && treeEmpty
            ? treeEmpty
            : roots.map((root) => (
                <TreeRow
                  key={root.id}
                  node={root}
                  depth={1}
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

      {/* ── What is in them ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--rule)] px-1 py-0.5">
          {itemsToolbar}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}

// The small text buttons that head each pane: «+ Add», «Edit», «To archive».
// Flat, iconed, and greyed rather than hidden — the reference's own row.
export function RefPaneButton({ icon: IconComp, label, disabled, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex shrink-0 items-center gap-1 px-1.5 py-1 text-xs ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-black/5'
      }`}
    >
      <IconComp className={`size-3.5 ${tone || ''}`} strokeWidth={2} />
      {label}
    </button>
  )
}
