import { useTranslation } from 'next-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function ClientCardsTab() {
  const { t } = useTranslation('clientProfile')
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{t('cardsTab.title')}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('cardsTab.packageName')}</TableHead>
              <TableHead>{t('cardsTab.type')}</TableHead>
              <TableHead>{t('cardsTab.startDate')}</TableHead>
              <TableHead>{t('cardsTab.endDate')}</TableHead>
              <TableHead>{t('cardsTab.remainingSessions')}</TableHead>
              <TableHead>{t('cardsTab.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                {t('cardsTab.empty')}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
