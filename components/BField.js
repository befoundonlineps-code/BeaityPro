import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import NumberField from '@/components/ui/NumberField'

// ⚠️ أيُّ حقلٍ رقميٍّ هنا يمرّ من `NumberField` — التقريبُ إلى خانتين ورسالتُه.
// وبلا هذا السطر يبقى `ClientForm` وحدَه صامتًا، **وصمتُ حقلٍ واحدٍ من عشرين
// أسوأُ من صمتِ العشرين**: القاعدةُ تصير «أحيانًا» ولا شيء يقول متى.
export default function BField({ label, id, ...props }) {
  const Field = props.type === 'number' ? NumberField : Input
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Field id={id} {...props} />
    </div>
  )
}
