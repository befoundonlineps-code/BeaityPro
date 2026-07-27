import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function ClientBalanceSummary({ balance }) {
  const isNegative = balance < 0
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">الرصيد الحالي</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-foreground'}`}>
          {balance.toLocaleString('ar')}₪
        </div>
      </CardContent>
    </Card>
  )
}
