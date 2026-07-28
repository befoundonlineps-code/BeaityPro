import { useTranslation } from 'next-i18next'
import { Card, CardContent } from '@/components/ui/card'

export default function ClientHistoryTab() {
  const { t } = useTranslation('clientProfile')
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-sm font-medium text-foreground">{t('historyTab.emptyTitle')}</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          {t('historyTab.emptyHint')}
        </div>
      </CardContent>
    </Card>
  )
}
