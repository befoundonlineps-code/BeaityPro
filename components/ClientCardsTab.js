import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default function ClientCardsTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">باقات واشتراكات الزبون</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الباقة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>تاريخ البدء</TableHead>
              <TableHead>تاريخ الانتهاء</TableHead>
              <TableHead>الجلسات المتبقية</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                ما في باقات مسجّلة لسا
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
