'use client'

import { Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const medalStyles: Record<string, string> = {
  gold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  silver: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
  bronze: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

export function RankingCard({ title, items, currentCompanyId }: { title: string; items: any[]; currentCompanyId?: string }) {
  return (
    <Card className="glass border-border/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center justify-between rounded-2xl border p-4 ${item.id === currentCompanyId ? 'border-primary bg-primary/5' : 'border-border bg-card/60'}`}>
            <div>
              <p className="font-medium">{item.nomeFantasia || item.razaoSocial}</p>
              <p className="text-xs text-muted-foreground">{item.segmento || 'Setor não informado'}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.medal ? (
                <Badge className={medalStyles[item.medal]}>
                  <Medal className="mr-1 h-3 w-3" />
                  {item.rankingPosition}º
                </Badge>
              ) : (
                <Badge variant="outline">#{item.rankingPosition}</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}