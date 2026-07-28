import { useTranslation } from 'next-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function ClientBalanceSummary({ balance }) {
  const { t } = useTranslation('clientProfile')
  const isNegative = balance < 0
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{t('balanceSummary.currentBalanceTitle')}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-foreground'}`}>
          {balance.toLocaleString('ar')}₪
        </div>
      </CardContent>
    </Card>
  )
}
