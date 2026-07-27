import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function BField({ label, id, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  )
}
