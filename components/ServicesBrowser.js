import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { Plus, Minus, Pencil, Archive, Copy, Search } from 'lucide-react'
import { buildServiceTree } from '../lib/serviceTree'
import { isCategoryArchived, countAffectedServices } from '../lib/categoryVisibility'
import { indexCategoriesById } from '../lib/categoryTypes'
import { useBusinessTypes } from '../hooks/useBusinessTypes'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import ServiceFormDialog from './ServiceFormDialog'
import CategoryFormDialog from './CategoryFormDialog'
import { setCategoryArchived, setServiceArchived, insertServiceCopy } from '../lib/categoryAdminIO'
import { copyName, serviceCopyPayload } from '../lib/serviceCopy'
import { reportDbError } from '../lib/dbErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// A toolbar button: an icon over a word, the same shape the reference screen
// uses and the same one the clients bar already uses in this app.
function ToolButton({ icon: Icon, label, disabled, onClick }) {
  return (
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClick}>
      <Icon />
      {label}
    </Button>
  )
}

// One row of the category tree. Folders open and close on their own button so
// that selecting a folder and opening it stay two different acts — picking a
// category to add a service to should not force its contents open.
function CategoryRow({ node, depth, expanded, onToggle, selectedId, onSelect, archived, t }) {
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

        {archived && <Badge variant="outline" className="shrink-0">{t('services:archivedBadge')}</Badge>}
      </div>

      {open && (node.children || []).map((sub) => (
        <CategoryRow
          key={sub.id}
          node={sub}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
          archived={archived || sub.is_active === false}
          t={t}
        />
      ))}
    </div>
  )
}

// The services screen: the folders on one side, what is in the selected one on
// the other.
//
// Replaces the single stacked tree, which put every service of every category
// on one page and made "what is in hairdressing?" a scrolling question. The
// reference screen is left-to-right; here the tree leads, which in an RTL page
// puts it on the right.
export default function ServicesBrowser({ salonId }) {
  const { t } = useTranslation(['services', 'common'])
  const router = useRouter()
  const { types, loading: typesLoading } = useBusinessTypes()
  const { categories, services, loading: catalogLoading, reload } = useServiceCatalog()

  if (typesLoading || catalogLoading) {
    return <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  if (types.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="font-medium">{t('services:noBusinessTypesTitle')}</div>
          <p className="text-sm text-muted-foreground">{t('services:noBusinessTypesMessage')}</p>
          <Button onClick={() => router.push('/settings?tab=businessTypes')}>
            {t('services:goToSettingsButton')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <ServicesBrowserView
      categories={categories}
      services={services}
      types={types}
      salonId={salonId}
      onReload={reload}
    />
  )
}

// The screen itself, given its data rather than fetching it.
//
// Split for the same reason CalendarToolbar was: the wrapper above returns an
// empty-state card long before the layout when a salon has no business types
// chosen, so inline there was no way to render this at all — the first attempt
// to measure it found zero panes.
export function ServicesBrowserView({ categories, services, types, salonId, onReload }) {
  const { t } = useTranslation(['services', 'common'])
  const reload = onReload

  const [expanded, setExpanded] = useState(() => new Set())
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null) // { service, categoryId }
  const [categoryDialog, setCategoryDialog] = useState(null) // { category }
  const [archiveTarget, setArchiveTarget] = useState(null) // the category being taken out or put back
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // The catalogue shows archived folders rather than hiding them — this is
  // where they are brought back, and a folder you cannot see is a folder you
  // cannot restore. The business-type filter is untouched.
  const tree = useMemo(
    () => buildServiceTree(categories, services, types),
    [categories, services, types]
  )
  const byId = useMemo(() => indexCategoriesById(categories), [categories])
  const selectedCategory = selectedCategoryId ? byId[selectedCategoryId] : null

  const rows = useMemo(() => {
    if (!selectedCategoryId) return []
    const q = search.trim().toLowerCase()
    return (services || [])
      .filter((s) => s.category_id === selectedCategoryId)
      .filter((s) => !q || (s.name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [services, selectedCategoryId, search])

  const selectedService = rows.find((s) => s.id === selectedServiceId) || null

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectCategory(id) {
    setSelectedCategoryId(id)
    setSelectedServiceId(null)
  }

  // Whether the selected folder is out because of its own flag. A folder
  // hidden only by an archived parent is not restorable from here — you put
  // the parent back, and it comes with it — so the button follows the flag
  // rather than the resolved state.
  const selectedIsArchived = selectedCategory?.is_active === false

  // A copy lands in the folder on screen, active, with a name nobody has to
  // squint at to tell apart from the original.
  async function copySelectedService() {
    if (!selectedService) return
    setBusy(true)
    setError('')

    const name = copyName(
      selectedService.name,
      (services || []).filter((s) => s.category_id === selectedCategoryId).map((s) => s.name),
      t('services:copySuffix'),
      (base, n) => t('services:copyNumbered', { base, number: n })
    )

    const { ok, error: writeError, row } = await insertServiceCopy(
      serviceCopyPayload(selectedService, { categoryId: selectedCategoryId, salonId, name })
    )
    setBusy(false)

    if (!ok) {
      setError(writeError
        ? t(reportDbError(writeError, 'ServicesBrowser.copyService'))
        : t('services:toggleFailedMessage'))
      return
    }

    // Select the copy, so the next press acts on it rather than on what it
    // came from — renaming is almost always the next thing.
    if (row?.id) setSelectedServiceId(row.id)
    reload()
  }

  async function toggleServiceArchived() {
    if (!selectedService) return
    setBusy(true)
    setError('')

    const { ok, error: writeError } = await setServiceArchived(
      selectedService.id,
      selectedService.is_active !== false
    )
    setBusy(false)

    if (!ok) {
      setError(writeError
        ? t(reportDbError(writeError, 'ServicesBrowser.archiveService'))
        : t('services:toggleFailedMessage'))
      return
    }
    reload()
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setBusy(true)
    setError('')
    const { ok, error: writeError } = await setCategoryArchived(
      archiveTarget.id,
      archiveTarget.is_active !== false
    )
    setBusy(false)

    if (!ok) {
      setError(writeError
        ? t(reportDbError(writeError, 'ServicesBrowser.archiveCategory'))
        : t('services:toggleFailedMessage'))
      return
    }
    setArchiveTarget(null)
    reload()
  }


  return (
    <>
      <div className="flex min-h-0 flex-col gap-3 lg:h-[calc(100vh-15rem)] lg:flex-row">
        {/* ── The folders ─────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border lg:w-80">
          <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-1 py-1">
            <ToolButton
              icon={Plus}
              label={t('services:categoryToolbar.add')}
              onClick={() => setCategoryDialog({ category: null })}
            />
            <ToolButton
              icon={Pencil}
              label={t('services:categoryToolbar.edit')}
              disabled={!selectedCategory}
              onClick={() => setCategoryDialog({ category: selectedCategory })}
            />
            <ToolButton
              icon={Archive}
              label={t(selectedIsArchived
                ? 'services:categoryToolbar.restore'
                : 'services:categoryToolbar.archive')}
              disabled={!selectedCategory}
              onClick={() => setArchiveTarget(selectedCategory)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {tree.map((root) => (
              <CategoryRow
                key={root.id}
                node={root}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                selectedId={selectedCategoryId}
                onSelect={selectCategory}
                archived={isCategoryArchived(root, byId)}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* ── What is in the selected one ─────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border">
          <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-1 py-1">
            <ToolButton
              icon={Plus}
              label={t('services:addServiceButton')}
              disabled={!selectedCategoryId}
              onClick={() => setDialog({ service: null, categoryId: selectedCategoryId })}
            />
            <ToolButton
              icon={Copy}
              label={t('services:serviceToolbar.copy')}
              disabled={!selectedService || busy}
              onClick={copySelectedService}
            />
            <ToolButton
              icon={Pencil}
              label={t('services:serviceToolbar.edit')}
              disabled={!selectedService}
              onClick={() => setDialog({ service: selectedService, categoryId: selectedCategoryId })}
            />
            {/* No confirmation, unlike a category: this takes one service off
                the list and the same press puts it back, so a dialog would
                only be in the way. */}
            <ToolButton
              icon={Archive}
              label={t(selectedService && selectedService.is_active === false
                ? 'services:serviceToolbar.restore'
                : 'services:serviceToolbar.archive')}
              disabled={!selectedService || busy}
              onClick={toggleServiceArchived}
            />

            <div className="relative ms-auto w-56">
              <Search className="pointer-events-none absolute inset-y-0 end-2 my-auto size-3.5 text-muted-foreground" />
              <Input
                className="pe-7"
                placeholder={t('services:searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {!selectedCategoryId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              {t('services:pickCategoryHint')}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('services:columns.name')}</th>
                    <th className="w-28 px-3 py-2 text-start font-medium">{t('services:columns.duration')}</th>
                    <th className="w-32 px-3 py-2 text-start font-medium">{t('services:columns.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedServiceId(s.id)}
                      onDoubleClick={() => setDialog({ service: s, categoryId: selectedCategoryId })}
                      className={`cursor-pointer border-b border-border/60 ${
                        selectedServiceId === s.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: s.color || 'var(--color-muted-foreground)' }}
                          />
                          <span className={s.is_active ? '' : 'text-muted-foreground line-through'}>{s.name}</span>
                          {!s.is_active && <Badge variant="outline">{t('services:inactiveBadge')}</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {t('services:minutesShort', { count: s.duration_minutes })}
                      </td>
                      <td className="px-3 py-1.5">
                        {Number(s.price) > 0
                          ? t('services:priceShort', { price: Number(s.price).toLocaleString('ar') })
                          : <span className="text-muted-foreground">{t('services:noPriceSet')}</span>}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        {search.trim() ? t('common:noResults') : t('services:emptyCategory')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ServiceFormDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        service={dialog?.service}
        categoryId={dialog?.categoryId}
        salonId={salonId}
        onSaved={reload}
      />

      <CategoryFormDialog
        open={!!categoryDialog}
        onOpenChange={(open) => { if (!open) setCategoryDialog(null) }}
        category={categoryDialog?.category}
        categories={categories}
        defaultParentId={categoryDialog?.category ? null : selectedCategoryId}
        salonId={salonId}
        onSaved={reload}
      />

      {/* Archiving is asked about rather than done. It reaches further than
          this screen — the folder's services stop being offered in the
          booking dialog and stop appearing in the price matrix — and the
          count says how many, because "23 services" is the part somebody
          needs to hear before agreeing. */}
      <Dialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) { setArchiveTarget(null); setError('') } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(archiveTarget?.is_active === false
                ? 'services:archiveDialog.restoreTitle'
                : 'services:archiveDialog.archiveTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{archiveTarget?.name}</p>
            <p className="text-muted-foreground">
              {t(archiveTarget?.is_active === false
                ? 'services:archiveDialog.restoreMessage'
                : 'services:archiveDialog.archiveMessage',
              { count: countAffectedServices(archiveTarget, categories, services) })}
            </p>
            {error && <div className="text-destructive">{error}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveTarget(null); setError('') }}>
              {t('common:discard')}
            </Button>
            <Button disabled={busy} onClick={confirmArchive}>
              {busy ? t('common:saving') : t('common:done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
