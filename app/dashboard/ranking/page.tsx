'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { buildSectorRanking, calculateCompanyPerformance } from '@/lib/company-performance'
import { RankingCard } from '@/components/company/ranking-card'
import { Loader2 } from 'lucide-react'

export default function RankingPage() {
  const { company } = useAuth()
  const [ranking, setRanking] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRanking = async () => {
      if (!company?.segmento) {
        setRanking([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const companiesSnapshot = await getDocs(query(collection(db, 'companies'), where('segmento', '==', company.segmento)))
        const rows = await Promise.all(companiesSnapshot.docs.map(async (companyItem) => {
          const companyData = { id: companyItem.id, ...(companyItem.data() as any) }
          const [chatsSnap, callsSnap, ratingsSnap] = await Promise.all([
            getDocs(query(collection(db, 'chats'), where('companyId', '==', companyItem.id))),
            getDocs(query(collection(db, 'calls'), where('companyId', '==', companyItem.id))),
            getDocs(query(collection(db, 'ratings'), where('companyId', '==', companyItem.id))),
          ])
          return {
            ...companyData,
            performance: calculateCompanyPerformance({
              company: companyData,
              chats: chatsSnap.docs.map((item) => item.data()),
              calls: callsSnap.docs.map((item) => item.data()),
              ratings: ratingsSnap.docs.map((item) => item.data()),
            }),
          }
        }))
        setRanking(buildSectorRanking(rows))
      } catch {
        setRanking([])
      } finally {
        setLoading(false)
      }
    }

    loadRanking()
  }, [company?.segmento])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>

  return (
    <div className="space-y-6" data-testid="dashboard-ranking-page">
      <div>
        <h1 className="text-3xl font-bold">Ranking por setor</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ranking real da categoria baseado em avaliação, tempo de resposta, resolução e volume.</p>
      </div>
      <RankingCard title={`Empresas do setor ${company?.segmento || ''}`} items={ranking} currentCompanyId={company?.id} />
    </div>
  )
}
