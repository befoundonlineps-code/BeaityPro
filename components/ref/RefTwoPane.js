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

function TreeRow({ node, depth, expanded, onToggle, selectedId, onSelect, archived, archivedLabel, isUnassigned, unassignedLabel, passThrough }) {
  const hasChildren = (node.children || []).length > 0
  const selected = selectedId === node.id

  // 🔴 SHOWN, NEVER SELECTED — one call, and the tag and the refusal come out of
  // it together so they cannot describe different rows. lib/folderStorageScope.js
  // holds the reasoning; this only draws it.
  const note = passThrough ? passThrough(node) : null

  // ⚠️ AND ALWAYS OPEN. A pass-through row is on screen for exactly one reason:
  // the folder underneath it belongs here and cannot be reached otherwise. A
  // collapsed one hides the only thing it is for, and since it cannot be
  // selected either, it would be a row that does nothing at all.
  const open = !!note || expanded.has(node.id)

  const label = (
    <>
      {open ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
      <span className="truncate">{node.name}</span>
      {archived && <span className="shrink-0 opacity-70">({archivedLabel})</span>}
      {/* ⚠️ Said rather than left to be noticed. A folder that appears under
          «all storages» and under no single storage looks like a bug until
          something names the state — and a folder shown by courtesy of its
          child is the same problem one storage down. The pass-through note wins
          when both apply: it is the one that explains why the row is inert. */}
      {note ? (
        <span className="shrink-0 border border-[var(--rule)] px-1 text-[10px] leading-none opacity-70">
          {note.tag}
        </span>
      ) : unassignedLabel && isUnassigned && isUnassigned(node) ? (
        <span className="shrink-0 border border-[var(--rule)] px-1 text-[10px] leading-none opacity-70">
          {unassignedLabel}
        </span>
      ) : null}
    </>
  )

  const labelClass = `flex min-w-0 flex-1 items-center gap-1.5 truncate px-1 py-[3px] text-start text-xs ${
    archived ? 'line-through opacity-60' : ''
  }`

  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      >
        {hasChildren && !note ? (
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

        {note ? (
          // ⚠️ A span, not a disabled button. A disabled button is still a
          // control that says «you may not» about something you might want; this
          // row is not a control at all, and the title says what it IS and where
          // to go — the project's rule that a refusal names a door.
          <span
            data-tree-node={node.id}
            data-pass-through="true"
            title={note.title}
            className={`${labelClass} opacity-60`}
          >
            {label}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            data-tree-node={node.id}
            className={labelClass}
            style={selected ? { background: 'var(--chrome)', color: 'var(--chrome-ink)' } : undefined}
          >
            {label}
          </button>
        )}
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
          isUnassigned={isUnassigned}
          unassignedLabel={unassignedLabel}
          passThrough={passThrough}
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
  isUnassigned,
  unassignedLabel,
  // (node) => { tag, title } | null — a folder drawn here without belonging
  // here. One function rather than a predicate beside a label, so the row that
  // is inert and the row that says why are the same row by construction.
  passThrough,
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
          {/* 🔴 A HEADING, NOT A BUTTON — AND IT WAS A BUTTON UNTIL THE FOLDER
              RULE CHANGED. It used to be selectable and highlighted whenever
              nothing else was, because «nothing selected» meant «every product»
              and that was a real view worth naming.
              «Nothing selected» now means an EMPTY GRID. A highlighted root
              above an empty grid reads as «this selection returned nothing» —
              the screen accusing itself. So the root names the tree and the
              storage, and selection is only ever a folder. */}
          <div
            data-tree-root
            className="flex w-full items-center gap-1.5 px-2 py-[3px] text-start text-xs font-semibold"
          >
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate">{rootLabel}</span>
          </div>

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
                  isUnassigned={isUnassigned}
                  unassignedLabel={unassignedLabel}
                  passThrough={passThrough}
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
export function RefPaneButton({ icon: IconComp, label, disabled, onClick, tone, blockedTitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // ⚠️ The refusal says what to do, and it is the only place it can. A
      // greyed button with no title is «not from here» with no «then from
      // where» — which the project already ruled is worse than not explaining
      // at all, because it names a problem and offers no door.
      title={disabled && blockedTitle ? blockedTitle : label}
      className={`flex shrink-0 items-center gap-1 px-1.5 py-1 text-xs ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-black/5'
      }`}
    >
      <IconComp className={`size-3.5 ${tone || ''}`} strokeWidth={2} />
      {label}
    </button>
  )
}
