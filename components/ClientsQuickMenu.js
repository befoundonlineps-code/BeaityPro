import { useState } from 'react'
import { useRouter } from 'next/router'
import { UserPlus, Pencil, Zap, Users, PlusCircle, MinusCircle, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import ClientPickerDialog from './ClientPickerDialog'
import BalanceDialog from './BalanceDialog'
import Icon from './Icon'

const PICKER_TITLES = {
  edit: 'تعديل زبون — اختر الزبون',
  credit: 'إضافة للرصيد — اختر الزبون',
  debit: 'خصم من الرصيد — اختر الزبون',
}

export default function ClientsQuickMenu({ triggerClassName, onDisabledClick }) {
  const router = useRouter()
  const [pickerAction, setPickerAction] = useState(null) // 'edit' | 'credit' | 'debit' | null
  const [balanceTarget, setBalanceTarget] = useState(null) // { clientId, type }

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
    await supabase.from('client_ledger').insert([{
      client_id: balanceTarget.clientId, type: balanceTarget.type, amount, note: note || null,
    }])
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={triggerClassName} title="الزبائن">
          <Icon name="clients" size={18} />
          <span className="whitespace-nowrap">الزبائن</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={10} className="w-56">
          <DropdownMenuItem onClick={() => router.push('/?new=1')}>
            <UserPlus /> زبون جديد
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPickerAction('edit')}>
            <Pencil /> تعديل زبون
          </DropdownMenuItem>
          <DropdownMenuItem className="text-muted-foreground/60" onClick={() => onDisabledClick('بيع سريع')}>
            <Zap /> بيع سريع
            <span className="ms-auto text-[10px]">قريبًا</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-muted-foreground/60" onClick={() => onDisabledClick('بالصالون الآن')}>
            <Users /> بالصالون الآن
            <span className="ms-auto text-[10px]">قريبًا</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPickerAction('credit')}>
            <PlusCircle /> إضافة للرصيد
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPickerAction('debit')}>
            <MinusCircle /> خصم من الرصيد
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-muted-foreground/60" onClick={() => onDisabledClick('الشركات')}>
            <Building2 /> الشركات
            <span className="ms-auto text-[10px]">قريبًا</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientPickerDialog
        open={!!pickerAction}
        title={PICKER_TITLES[pickerAction] || ''}
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
