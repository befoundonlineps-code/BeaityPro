import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Plus, Archive, Pencil } from 'lucide-react'
import StorageFormDialog from './StorageFormDialog'
import { dbErrorSentence } from '../lib/dbErrors'
import { setStorageArchived } from '../lib/inventoryAdminIO'
import { responsiblesVisible, responsibleCounts } from '../lib/storageForm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// The storages screen.
//
// A flat list, not a tree: storages have no parent and the reference's own
// window is a flat grid too. No delete button — storages has no RLS delete
// policy, so a delete comes back with zero rows rather than an error.
//
// A storage holding stock cannot be archived either, and that refusal is a
// trigger in the database rather than a check here. Its message arrives through
// reportDbError like any other, which is the whole reason that layer exists.
export default function StoragesManager({
  storages, responsibles, employees, loading, error, reload, salonId,
  // التشكيلة ومدخلاتُ رسالة الرفض — تمرّ من الصفحة إلى النافذة بلا أن تُستعمل
  // هنا. الصفحةُ محمَّلٌ عندها الكتالوجُ والأرصدةُ أصلًا.
  categories = [], products = [], balances = [], storageCategories = [],
}) {
  const { t } = useTranslation(['products', 'employees', 'common'])
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const employeeName = (id) => (employees || []).find((e) => e.id === id)?.name || '—'

  function countsFor(storageId) {
    return responsibleCounts((responsibles || []).filter((r) => r.storage_id === storageId))
  }

  async function toggleArchived(storage) {
    setBusy(true)
    setActionError('')
    const { ok, error: writeError } = await setStorageArchived(
      storage.id, storage.is_active !== false
    )
    setBusy(false)
    if (!ok) {
      setActionError(writeError
        ? dbErrorSentence(writeError, t, 'StoragesManager.archive')
        : t('products:storages.archiveFailed'))
      return
    }
    reload()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Above the list, never instead of it — ADR-048. */}
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t('products:loadFailedTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'StoragesManager.load')}
          </span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('products:storages.hint')}</p>
        <Button onClick={() => setDialog({ storage: null })}>
          <Plus />
          {t('products:storages.addButton')}
        </Button>
      </div>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
      ) : storages.length === 0 ? (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          <span>{t('products:storages.emptyTitle')}</span>
          <span className="text-xs">{t('products:storages.emptyHint')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storages.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`truncate font-medium ${s.is_active === false ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {s.name}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="outline" size="icon" className="size-7"
                      title={t('products:storages.edit')}
                      onClick={() => setDialog({ storage: s })}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="size-7"
                      disabled={busy}
                      title={t(s.is_active === false ? 'products:storages.restore' : 'products:storages.archive')}
                      onClick={() => toggleArchived(s)}>
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{t(`products:storageDialog.kind_${s.kind}`)}</Badge>
                  {s.kind === 'professional' && (
                    <Badge variant="outline">{employeeName(s.owner_employee_id)}</Badge>
                  )}
                  {/* Two badges, never one total. Two people named is two
                      people; two roles ticked is everybody in them today and
                      everybody hired into them later — and one number hides
                      exactly that difference. */}
                  {responsiblesVisible(s.kind) && (() => {
                    const { people, roles } = countsFor(s.id)
                    if (people === 0 && roles === 0) {
                      return <Badge variant="outline">{t('products:storages.noResponsiblesBadge')}</Badge>
                    }
                    return (
                      <>
                        {people > 0 && (
                          <Badge variant="outline">
                            {t('products:storages.peopleBadge', { count: people })}
                          </Badge>
                        )}
                        {roles > 0 && (
                          <Badge variant="outline">
                            {t('products:storages.rolesBadge', { count: roles })}
                          </Badge>
                        )}
                      </>
                    )
                  })()}
                  {s.sale_enabled === false && (
                    <Badge variant="outline">{t('products:storages.noSaleBadge')}</Badge>
                  )}
                  {s.is_active === false && (
                    <Badge variant="outline">{t('products:archivedBadge')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StorageFormDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        storage={dialog?.storage}
        employees={employees}
        responsibles={responsibles}
        categories={categories}
        products={products}
        balances={balances}
        storageCategories={storageCategories}
        salonId={salonId}
        onSaved={reload}
      />
    </div>
  )
}
