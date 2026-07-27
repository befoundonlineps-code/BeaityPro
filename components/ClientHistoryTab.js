import { Card, CardContent } from '@/components/ui/card'

export default function ClientHistoryTab() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-sm font-medium text-foreground">لسا ما في زيارات</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          هاد التبويب رح يتفعّل تلقائياً لما يُبنى موديول الحجوزات
        </div>
      </CardContent>
    </Card>
  )
}
