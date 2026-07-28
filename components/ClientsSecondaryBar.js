import { useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { UserPlus, Pencil, Zap, Users, PlusCircle, MinusCircle, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { emitLedgerChanged } from '../lib/ledgerEvents'
import ClientPickerDialog from './ClientPickerDialog'
import BalanceDialog from './BalanceDialog'

function SecondaryItem({ icon: IconComp, label, soon, soonLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={soon ? `${label} — ${soonLabel}` : label}
      className={
        soon
          ? 'flex shrink-0 cursor-not-allowed flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground/50 hover:bg-sidebar-accent'
          : 'flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] text-foreground hover:bg-sidebar-accent'
      }
    >
      <IconComp className="size-5" />
      <span className="whitespace-nowrap">{label}</span>
      {soon && <span className="text-[9px] leading-none">{soonLabel}</span>}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-10 w-px shrink-0 bg-border" />
}

export default function ClientsSecondaryBar({ onDisabledClick }) {
  const { t } = useTranslation(['topBar', 'common'])
  const router = useRouter()
  const [pickerAction, setPickerAction] = useState(null) // 'edit' | 'credit' | 'debit' | null
  const [balanceTarget, setBalanceTarget] = useState(null) // { clientId, type }

  const pickerTitles = {
    edit: t('topBar:pickerTitles.edit'),
    credit: t('topBar:pickerTitles.credit'),
    debit: t('topBar:pickerTitles.debit'),
  }
  const soonLabel = t('topBar:soonBadge')

  function handlePick(client) {
    if (pickerAction === 'edit') {
      router.push(`/clients/${client.id}`)
    } else if (pickerAction === 'credit' || pickerAction === 'debit') {
      setBalanceTarget({ clientId: client.id, type: pickerAction })
    }
    setPickerAction(null)
  }

  async function submitBalanceEntry(amount, note) {
    if (!balanceTarget) return
    const { error } = await supabase.from('client_ledger').insert([{
      client_id: balanceTarget.clientId, type: balanceTarget.type, amount, note: note || null,
    }])
    if (!error) emitLedgerChanged()
  }

  return (
    <>
      <div className="flex w-full items-center gap-1 overflow-x-auto border-b border-sidebar-border bg-muted/40 px-4 py-1.5">
        <SecondaryItem icon={UserPlus} label={t('topBar:secondaryItems.newClient')} onClick={() => router.push('/?new=1')} />
        <SecondaryItem icon={Pencil} label={t('topBar:secondaryItems.editClient')} onClick={() => setPickerAction('edit')} />
        <SecondaryItem icon={Zap} label={t('topBar:secondaryItems.quickSale')} soon soonLabel={soonLabel} onClick={() => onDisabledClick(t('topBar:secondaryItems.quickSale'))} />
        <SecondaryItem icon={Users} label={t('topBar:secondaryItems.atSalon')} soon soonLabel={soonLabel} onClick={() => onDisabledClick(t('topBar:secondaryItems.atSalon'))} />
        <Divider />
        <SecondaryItem icon={PlusCircle} label={t('topBar:secondaryItems.addBalance')} onClick={() => setPickerAction('credit')} />
        <SecondaryItem icon={MinusCircle} label={t('topBar:secondaryItems.removeBalance')} onClick={() => setPickerAction('debit')} />
        <Divider />
        <SecondaryItem icon={Building2} label={t('topBar:secondaryItems.companies')} soon soonLabel={soonLabel} onClick={() => onDisabledClick(t('topBar:secondaryItems.companies'))} />
      </div>

      <ClientPickerDialog
        open={!!pickerAction}
        title={pickerTitles[pickerAction] || ''}
        onOpenChange={(open) => { if (!open) setPickerAction(null) }}
        onPick={handlePick}
      />

      <BalanceDialog
        open={!!balanceTarget}
        type={balanceTarget?.type}
        onOpenChange={(open) => { if (!open) setBalanceTarget(null) }}
        onSubmit={submitBalanceEntry}
      />
    </>
  )
}
