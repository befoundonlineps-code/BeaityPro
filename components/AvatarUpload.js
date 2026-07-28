import { useRef } from 'react'
import { useTranslation } from 'next-i18next'
import { Camera, User } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export default function AvatarUpload({ photoUrl, fallbackColor, fallbackInitials, uploading, disabled, onFileSelected }) {
  const { t } = useTranslation('common')
  const inputRef = useRef(null)
  const isDisabled = uploading || disabled

  function handleChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFileSelected(file)
  }

  return (
    <div className="relative inline-flex shrink-0">
      <Avatar className="size-14">
        {photoUrl && <AvatarImage src={photoUrl} alt="" />}
        <AvatarFallback style={fallbackColor ? { background: fallbackColor, color: '#fff' } : undefined}>
          {fallbackInitials || <User className="size-1/2 text-muted-foreground" />}
        </AvatarFallback>
      </Avatar>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => inputRef.current?.click()}
        title={t('changePhoto')}
        className="absolute end-0 bottom-0 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background disabled:opacity-50"
      >
        <Camera className="size-3.5" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  )
}
