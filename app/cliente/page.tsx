'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  Search,
  MessageCircle,
  Building2,
  Star,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Company, Chat } from '@/lib/types'
import { isPublicCompany } from '@/lib/public-company'

export default function ClientePage() {
  const router = useRouter()
  const { user, userData, signOut, loading: authLoading } = useAuth()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const companiesQuery = query(collection(db, 'companies'), limit(20))
        const [snapshot, ratingsSnapshot] = await Promise.all([
          getDocs(companiesQuery),
          getDocs(collection(db, 'ratings')),
        ])
        const ratingsByCompany = ratingsSnapshot.docs.reduce((acc: Record<string, { total: number; sum: number }>, item) => {
          const data = item.data() as any
          const companyId = data.companyId
          const rating = Number(data.rating || data.nota || 0)
          if (!companyId || !rating) return acc
          acc[companyId] = acc[companyId] || { total: 0, sum: 0 }
          acc[companyId].total += 1
          acc[companyId].sum += rating
          return acc
        }, {})
        const companiesData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((company: any) => isPublicCompany(company)) as Company[]
        setCompanies(companiesData.map((company: any) => {
          const ratingData = ratingsByCompany[company.id]
          return ratingData
            ? { ...company, rating: ratingData.sum / ratingData.total, totalReviews: ratingData.total, totalAvaliacoes: ratingData.total }
            : company
        }))
      } catch (error) {
        console.error('Error fetching companies:', error)
      }
    }

    fetchCompanies()
  }, [])

  // Fetch recent chats
  useEffect(() => {
    const fetchRecentChats = async () => {
      if (!user) return

      try {
        const chatsQuery = query(
          collection(db, 'chats'),
          where('clientId', '==', user.uid),
          orderBy('lastMessageAt', 'desc'),
          limit(5)
        )
        const snapshot = await getDocs(chatsQuery)
        const chatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Chat[]
        setRecentChats(chatsData)
      } catch (error) {
        console.error('Error fetching chats:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchRecentChats()
    } else {
      setLoading(false)
    }
  }, [user])

  const filteredCompanies = companies.filter(company =>
    company.nomeFantasia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.razaoSocial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.segmento?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="mx-auto max-w-7xl space-y-6 px-2 lg:px-0">
          {/* Welcome Section */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              Ola, {userData?.fullName?.split(' ')[0] || 'Usuario'}!
            </h1>
            <p className="text-muted-foreground">
              Encontre empresas e inicie uma conversa
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar empresas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base bg-card border-border focus-ring"
            />
          </div>

          {/* Recent Chats */}
          {recentChats.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Conversas Recentes
                </h2>
                <Link href="/cliente/atendimentos" className="text-sm text-primary hover:underline" data-testid="client-home-history-link">
                  Ver todas
                </Link>
              </div>
              
              <div className="grid gap-3">
                {recentChats.map((chat) => (
                  <Card
                    key={chat.id}
                    className="cursor-pointer card-hover border-border bg-card/80"
                    onClick={() => router.push(`/cliente/chat/${chat.id}`)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{chat.companyName || 'Empresa'}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {chat.lastMessage || 'Sem mensagens'}
                        </p>
                      </div>
                      {chat.unreadCount && chat.unreadCount > 0 && (
                        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                          {chat.unreadCount}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Companies */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              Empresas Disponiveis
            </h2>
            
            {filteredCompanies.length === 0 ? (
              <Card className="border-border bg-card/80">
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-1">Nenhuma empresa encontrada</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Tente uma busca diferente' : 'Ainda nao ha empresas cadastradas'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCompanies.map((company) => (
                  <Card
                    key={company.id}
                    className="cursor-pointer card-hover border-border bg-card/80"
                    onClick={() => router.push(`/empresa/${company.id}`)}
                    data-testid={`client-company-card-${company.id}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {company.logoURL ? (
                          <img
                            src={company.logoURL}
                            alt={company.nomeFantasia}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-primary-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {company.nomeFantasia || company.razaoSocial}
                          </h3>
                          {company.segmento && (
                            <p className="text-sm text-muted-foreground truncate">
                              {company.segmento}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {company.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {company.descricao}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span>{Number(company.rating || company.avaliacaoMedia || 0).toFixed(1)} ({Number(company.totalReviews || company.totalAvaliacoes || 0)})</span>
                        </div>
                        <Button size="sm" className="h-8 gap-1" data-testid={`client-company-chat-button-${company.id}`}>
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
      </div>
    </div>
  )
}
