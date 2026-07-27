import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useClientSearch } from '../hooks/useClientSearch'
import { getAvatarColor, getInitials } from '../lib/avatarColor'

export default function ClientPickerDialog({ open, title, onOpenChange, onPick }) {
  const { search, setSearch, results } = useClientSearch()

  function handleOpenChange(next) {
    if (!next) setSearch('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted"
                onClick={() => onPick(c)}
              >
                <Avatar size="sm">
                  <AvatarFallback style={{ background: getAvatarColor(c.id), color: '#fff' }}>
                    {getInitials(c.first_name, c.last_name)}
                  </AvatarFallback>
                </Avatar>
                <span>{c.first_name} {c.last_name} — {c.phone_number}</span>
              </button>
            ))}
            {search.trim().length >= 2 && results.length === 0 && (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">ما في نتائج</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
