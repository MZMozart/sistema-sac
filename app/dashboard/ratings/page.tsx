'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, MessageSquare, Phone, Star } from 'lucide-react'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

export default function RatingsPage() {
  const { company } = useAuth()
  const [ratings, setRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company?.id) return
    const ratingsQuery = query(collection(db, 'ratings'), where('companyId', '==', company.id))
    const unsubscribe = onSnapshot(ratingsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      setRatings(rows)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [company?.id])

  const summary = useMemo(() => {
    const average = ratings.length ? (ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratings.length).toFixed(1) : '0'
    return {
      total: ratings.length,
      average,
      chats: ratings.filter((item) => item.type === 'chat').length,
      calls: ratings.filter((item) => item.type === 'call').length,
    }
  }, [ratings])

  return (
    <div className="space-y-6" data-testid="dashboard-ratings-page">
      <div>
        <h1 className="text-3xl font-bold">Avaliações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Feedback real enviado por clientes após chats e ligações.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total', summary.total],
              ['Média', summary.average],
              ['Chats', summary.chats],
              ['Ligações', summary.calls],
            ].map(([label, value]) => (
              <Card key={String(label)} className="glass border-border/80">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3">
            {ratings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Nenhuma avaliação registrada ainda.</div>
            ) : ratings.map((item) => (
              <Card key={item.id} className="glass border-border/80" data-testid={`dashboard-rating-${item.id}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg">{item.clientName || 'Cliente'}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.protocol || item.entityId}</Badge>
                      <Badge className="bg-primary/10 text-primary">{item.type === 'call' ? <Phone className="mr-1 h-3 w-3" /> : <MessageSquare className="mr-1 h-3 w-3" />}{item.type}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400">{Array.from({ length: Number(item.rating || 0) }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
                  <p className="text-sm text-muted-foreground">{item.comment || 'Sem comentário adicional.'}</p>
                  <p className="text-xs text-muted-foreground">{item.createdAt ? toDate(item.createdAt).toLocaleString('pt-BR') : '-'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}