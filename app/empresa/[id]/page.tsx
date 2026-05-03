'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  Facebook,
  MessageCircle,
  Star,
  Clock,
  Phone,
  Mail,
  MapPin,
  Globe,
  CheckCircle2,
  Instagram,
  Linkedin,
  Loader2,
  Send,
} from 'lucide-react'
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, limit, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { buildSectorRanking, calculateCompanyPerformance } from '@/lib/company-performance'
import { rebalanceCallQueue } from '@/lib/call-queue'
import { getInitialChatFlowMessage } from '@/lib/bot-flow'
import { isPublicCompany } from '@/lib/public-company'
import { createAttendanceProtocol } from '@/lib/attendance-protocol'
import { VerifiedBadge } from '@/components/company/verified-badge'
import { RankingCard } from '@/components/company/ranking-card'
import type { Company, Chat, Review } from '@/lib/types'

function generateProtocol(prefix: 'CHT' | 'CAL') {
  return createAttendanceProtocol(prefix)
}

function normalizeExternalUrl(url?: string | null) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}

export default function EmpresaPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { user, userData, loading: authLoading } = useAuth()
  
  const [company, setCompany] = useState<Company | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [sectorRanking, setSectorRanking] = useState<any[]>([])
  const [performance, setPerformance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [startingChat, setStartingChat] = useState(false)
  const [startingCall, setStartingCall] = useState(false)

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const companyDoc = await getDoc(doc(db, 'companies', id))
        if (companyDoc.exists()) {
          const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company
          const canPreviewPrivate = userData?.companyId === companyData.id
          if (!isPublicCompany(companyData) && !canPreviewPrivate) {
            setCompany(null)
            setLoading(false)
            return
          }
          setCompany(companyData)
        }
      } catch (error) {
        console.error('Error fetching company:', error)
        toast.error('Erro ao carregar empresa')
      }
    }

    const fetchReviews = async () => {
      try {
        const reviewsQuery = query(
          collection(db, 'ratings'),
          where('companyId', '==', id),
          limit(20)
        )
        const snapshot = await getDocs(reviewsQuery)
        const reviewsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10) as Review[]
        setReviews(reviewsData)
      } catch (error) {
        console.error('Error fetching reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompany()
    fetchReviews()
  }, [id, userData?.companyId])

  useEffect(() => {
    const fetchSectorRanking = async () => {
      if (!company?.segmento) return

      const companiesSnapshot = await getDocs(query(collection(db, 'companies'), where('segmento', '==', company.segmento)))
      const rankingData = await Promise.all(companiesSnapshot.docs.map(async (companyItem) => {
        const companyData = { id: companyItem.id, ...(companyItem.data() as any) }
        if (!isPublicCompany(companyData)) return null
        const [chatsSnap, callsSnap, ratingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'chats'), where('companyId', '==', companyItem.id))),
          getDocs(query(collection(db, 'calls'), where('companyId', '==', companyItem.id))),
          getDocs(query(collection(db, 'ratings'), where('companyId', '==', companyItem.id))),
        ])

        const perf = calculateCompanyPerformance({
          company: companyData,
          chats: chatsSnap.docs.map((item) => item.data()),
          calls: callsSnap.docs.map((item) => item.data()),
          ratings: ratingsSnap.docs.map((item) => item.data()),
        })

        return { ...companyData, performance: perf }
      }))

      const ranking = buildSectorRanking(rankingData.filter(Boolean))
      setSectorRanking(ranking)
      const currentCompanyRanking = ranking.find((item) => item.id === id)
      setPerformance(currentCompanyRanking?.performance || null)
    }

    fetchSectorRanking()
  }, [company?.segmento, id])

  const handleStartChat = async () => {
    if (!user) {
      toast.error('Faca login para iniciar uma conversa')
      router.push('/auth/login')
      return
    }

    if (!company) return

    setStartingChat(true)
    try {
      const initialFlowMessage = getInitialChatFlowMessage(company)
      const newChat: Partial<Chat> = {
        protocolo: generateProtocol('CHT'),
        companyId: company.id,
        companyName: company.nomeFantasia || company.razaoSocial,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        clientEmail: user.email || '',
        status: 'bot',
        queuePosition: null,
        priority: 'normal',
        unreadCount: 0,
        createdAt: new Date(),
        lastMessageAt: new Date(),
        lastActivity: new Date(),
        botResolved: false,
        botAttempts: 0,
        botCurrentMessageId: initialFlowMessage?.id || null,
        botAwaitingResolvedConfirmation: false,
        botAwaitingAnythingElse: false,
      }

      const chatRef = await addDoc(collection(db, 'chats'), {
        ...newChat,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
      })

      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        companyId: company.id,
        content:
          initialFlowMessage?.text ||
          company.botGreeting ||
          `Olá, você está falando com o BOT da ${company.nomeFantasia || company.razaoSocial}. Me conte rapidamente o que aconteceu para eu tentar resolver antes de transferir para um atendente.`,
        type: 'text',
        senderType: 'bot',
        senderId: 'bot',
        senderName: `${company.nomeFantasia || company.razaoSocial} BOT`,
        createdAt: serverTimestamp(),
      })

      await createNotification({
        recipientCompanyId: company.id,
        title: 'Novo chat iniciado',
        body: `${userData?.fullName || user.displayName || 'Cliente'} iniciou o protocolo ${newChat.protocolo}.`,
        type: 'chat',
        actionUrl: `/dashboard/chats?chat=${chatRef.id}`,
        entityId: chatRef.id,
        entityType: 'chat',
        actorName: userData?.fullName || user.displayName || 'Cliente',
      })

      await createAuditLog({
        companyId: company.id,
        companyName: company.nomeFantasia || company.razaoSocial,
        protocol: newChat.protocolo,
        chatId: chatRef.id,
        channel: 'chat',
        eventType: 'chat_created',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        summary: 'Chat iniciado a partir do perfil público da empresa.',
      })

      router.push(`/cliente/chat/${chatRef.id}`)
    } catch (error) {
      console.error('Error starting chat:', error)
      toast.error('Erro ao iniciar conversa')
    } finally {
      setStartingChat(false)
    }
  }

  const handleStartCall = async () => {
    if (!user) {
      toast.error('Faca login para iniciar uma ligacao')
      router.push('/auth/login')
      return
    }

    if (!company) return

    setStartingCall(true)
    try {
      const callRef = doc(collection(db, 'call_sessions'))
      const callId = callRef.id
      const protocolo = generateProtocol('CAL')

      await setDoc(callRef, {
        id: callId,
        callId,
        protocolo,
        companyId: company.id,
        companyName: company.nomeFantasia || company.razaoSocial,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        clientEmail: user.email || '',
        status: 'waiting',
        queuePosition: 1,
        callBotGreeting: company.settings?.callBotGreeting || company.botGreeting || '',
        callBotOptions: company.settings?.callBotOptions || company.uraOptions || [],
        callBotVoice: company.settings?.callBotVoice || 'pt-BR',
        createdAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'calls', callId), {
        id: callId,
        protocolo,
        companyId: company.id,
        companyName: company.nomeFantasia || company.razaoSocial,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        status: 'waiting',
        queuePosition: 1,
        createdAt: serverTimestamp(),
      })

      await rebalanceCallQueue(company.id)

      await createNotification({
        recipientCompanyId: company.id,
        title: 'Nova ligação aguardando',
        body: `${userData?.fullName || user.displayName || 'Cliente'} iniciou a ligação ${protocolo}.`,
        type: 'call',
        actionUrl: '/dashboard/telephony',
        entityId: callId,
        entityType: 'call',
        actorName: userData?.fullName || user.displayName || 'Cliente',
      })

      await createAuditLog({
        companyId: company.id,
        companyName: company.nomeFantasia || company.razaoSocial,
        protocol: protocolo,
        callId,
        channel: 'call',
        eventType: 'call_created',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        summary: 'Ligação iniciada a partir do perfil público da empresa.',
      })

      router.push(`/cliente/call/${callId}`)
    } catch (error) {
      console.error('Error starting call:', error)
      toast.error('Erro ao iniciar ligacao')
    } finally {
      setStartingCall(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Building2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Empresa nao encontrada</h1>
        <p className="text-muted-foreground mb-6">Esta empresa nao existe ou foi removida</p>
        <Button onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Voltar ao inicio
        </Button>
      </div>
    )
  }

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, review: any) => sum + Number(review.rating || 0), 0) / reviews.length : Number(company.rating || 5.0)
  const totalReviews = reviews.length || company.totalReviews || 0
  const isOwnCompany = Boolean(userData?.companyId === company?.id)
  const primaryColor = company?.corPrimaria || '#2563eb'
  const accentColor = company?.corDestaque || '#38bdf8'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <Logo size="sm" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <div className="relative">
          {/* Cover */}
          <div className="h-32 sm:h-48" style={company?.bannerURL ? { backgroundImage: `url(${company.bannerURL})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(90deg, ${primaryColor}22, ${accentColor}22)` }} />
          
          {/* Company Info */}
          <div className="container mx-auto px-4">
            <div className="relative -mt-8 sm:-mt-10 pb-6 pt-6 flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Logo */}
              <div className="shrink-0">
                {company.logoURL ? (
                  <img
                    src={company.logoURL}
                    alt={company.nomeFantasia}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl border-4 border-background object-cover shadow-xl"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-36 sm:h-36 overflow-hidden rounded-2xl border-4 border-background flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                    {company?.logoURL ? <img src={company.logoURL} alt={company.nomeFantasia || 'Logo da empresa'} className="h-full w-full object-cover" /> : <Building2 className="w-14 h-14 sm:w-18 sm:h-18 text-primary-foreground" />}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold">
                    {company.nomeFantasia || company.razaoSocial}
                  </h1>
                  <VerifiedBadge verified={performance?.verificationStatus?.verified} tooltip={performance?.verificationStatus?.tooltip} />
                </div>
                
                {company.segmento && (
                  <p className="text-muted-foreground">{company.segmento}</p>
                )}

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span className="font-semibold">{averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({totalReviews} avaliacoes)</span>
                  </div>
                  {sectorRanking.find((item) => item.id === company.id)?.rankingPosition ? (
                    <span className="text-sm text-muted-foreground">Ranking no setor: #{sectorRanking.find((item) => item.id === company.id)?.rankingPosition}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {isOwnCompany ? (
                  <Button asChild size="lg" className="w-full sm:w-auto h-12 px-8 hover:opacity-90 glow btn-press" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                    <Link href="/dashboard/settings">Editar perfil</Link>
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  onClick={handleStartChat}
                  disabled={startingChat}
                  className="w-full sm:w-auto h-12 px-8 hover:opacity-90 glow btn-press"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                  data-testid="public-company-start-chat-button"
                >
                  {startingChat ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 w-5 h-5" />
                      Iniciar Conversa
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleStartCall}
                  disabled={startingCall}
                  className="w-full sm:w-auto h-12 px-8"
                  data-testid="public-company-start-call-button"
                >
                  {startingCall ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 w-5 h-5" />
                      Iniciar Ligação
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* About */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              {company.descricao && (
                <Card className="border-border bg-card/80">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-3">Sobre</h2>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {company.descricao}
                    </p>
                  </CardContent>
                </Card>
              )}

              {company.segmento && sectorRanking.length > 0 ? (
                <RankingCard title={`Ranking do setor ${company.segmento}`} items={sectorRanking.slice(0, 3).concat(sectorRanking.find((item) => item.id === company.id && item.rankingPosition > 3) ? [sectorRanking.find((item) => item.id === company.id)!] : [])} currentCompanyId={company.id} />
              ) : null}

              {/* Reviews */}
              <Card className="border-border bg-card/80">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Avaliacoes</h2>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                      <span className="font-semibold">{averageRating.toFixed(1)}</span>
                    </div>
                  </div>

                  {reviews.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Ainda nao ha avaliacoes</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={review.clientPhotoURL} />
                              <AvatarFallback className="bg-secondary">
                                {review.clientName?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{review.clientName || 'Usuario'}</span>
                                <div className="flex items-center gap-0.5">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < review.rating
                                          ? 'text-amber-500 fill-amber-500'
                                          : 'text-muted-foreground/30'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                              {review.comment && (
                                <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact Info */}
              <Card className="border-border bg-card/80">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold">Informacoes</h2>
                  
                  {company.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Phone className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="font-medium">{company.phone}</p>
                      </div>
                    </div>
                  )}

                  {company.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium truncate">{company.email}</p>
                      </div>
                    </div>
                  )}

                  {(company.website || company.instagram || company.facebook || company.linkedin || company.whatsapp) && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Links</p>
                      <div className="flex flex-wrap gap-2">
                        {company.website && (
                          <Button asChild variant="outline" size="sm">
                            <a href={normalizeExternalUrl(company.website)} target="_blank" rel="noopener noreferrer">
                              <Globe className="mr-2 h-4 w-4" />
                              Website
                            </a>
                          </Button>
                        )}
                        {company.instagram && (
                          <Button asChild variant="outline" size="sm">
                            <a href={normalizeExternalUrl(company.instagram)} target="_blank" rel="noopener noreferrer">
                              <Instagram className="mr-2 h-4 w-4" />
                              Instagram
                            </a>
                          </Button>
                        )}
                        {company.facebook && (
                          <Button asChild variant="outline" size="sm">
                            <a href={normalizeExternalUrl(company.facebook)} target="_blank" rel="noopener noreferrer">
                              <Facebook className="mr-2 h-4 w-4" />
                              Facebook
                            </a>
                          </Button>
                        )}
                        {company.linkedin && (
                          <Button asChild variant="outline" size="sm">
                            <a href={normalizeExternalUrl(company.linkedin)} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="mr-2 h-4 w-4" />
                              LinkedIn
                            </a>
                          </Button>
                        )}
                        {company.whatsapp && (
                          <Button asChild variant="outline" size="sm">
                            <a href={normalizeExternalUrl(company.whatsapp)} target="_blank" rel="noopener noreferrer">
                              <Phone className="mr-2 h-4 w-4" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {(company.address || company.endereco) && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Endereco</p>
                        <p className="font-medium">{company.address || company.endereco}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Business Hours */}
              {(company.settings?.businessHours?.enabled || company.horarioInicio) && (
                <Card className="border-border bg-card/80">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Horario de Atendimento
                    </h2>
                    {company.settings?.businessHours?.enabled ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(company.settings.businessHours.schedule || {}).map(([day, hours]: [string, any]) => (
                          <div key={day} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{day}</span>
                            <span className="font-medium">
                              {hours.closed ? 'Fechado' : `${hours.open} - ${hours.close}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Dias ativos</span><span className="font-medium">{(company.diasFuncionamento || []).length}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Atendimento</span><span className="font-medium">{company.horarioInicio || '--:--'} - {company.horarioFim || '--:--'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Almoço</span><span className="font-medium">{company.horarioAlmocoInicio || '--:--'} - {company.horarioAlmocoFim || '--:--'}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
