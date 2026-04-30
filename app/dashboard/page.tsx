'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Loader2, MessageSquare, Phone, ShieldCheck, Star, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Period = 'all' | '24h' | '7d' | '30d' | '90d'

function toDateValue(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

export default function DashboardPage() {
  const { company, loading: authLoading } = useAuth()
  const [period, setPeriod] = useState<Period>('all')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  const buildAnalytics = (selectedPeriod: Period, chats: any[], calls: any[], employees: any[], ratings: any[]) => {
    const now = new Date()
    const getStartDate = (periodValue: Period) => {
      if (periodValue === 'all') return null
      if (periodValue === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      if (periodValue === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (periodValue === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }

    const labelForDate = (date: Date, periodValue: Period) => {
      if (periodValue === 'all') return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      if (periodValue === '24h') return `${String(date.getHours()).padStart(2, '0')}h`
      if (periodValue === '7d') return date.toLocaleDateString('pt-BR', { weekday: 'short' })
      if (periodValue === '30d') return `S${Math.ceil(date.getDate() / 7)}`
      return date.toLocaleDateString('pt-BR', { month: 'short' })
    }

    const startDate = getStartDate(selectedPeriod)
    const chatsInPeriod = chats.filter((chat) => {
      const chatDate = toDateValue(chat.createdAt || chat.lastMessageAt)
      return !startDate || chatDate >= startDate
    })
    const callsInPeriod = calls.filter((call) => {
      const callDate = toDateValue(call.createdAt || call.startTime)
      return !startDate || callDate >= startDate
    })
    const ratingsInPeriod = ratings.filter((rating) => {
      const ratingDate = toDateValue(rating.createdAt)
      return !startDate || ratingDate >= startDate
    })

    const chartMap = new Map<string, { name: string; chats: number; calls: number; sortValue: number }>()
    chatsInPeriod.forEach((chat) => {
      const chatDate = toDateValue(chat.createdAt || chat.lastMessageAt)
      const key = labelForDate(chatDate, selectedPeriod)
      chartMap.set(key, {
        name: key,
        chats: (chartMap.get(key)?.chats || 0) + 1,
        calls: chartMap.get(key)?.calls || 0,
        sortValue: chatDate.getTime(),
      })
    })
    callsInPeriod.forEach((call) => {
      const callDate = toDateValue(call.createdAt || call.startTime)
      const key = labelForDate(callDate, selectedPeriod)
      chartMap.set(key, {
        name: key,
        chats: chartMap.get(key)?.chats || 0,
        calls: (chartMap.get(key)?.calls || 0) + 1,
        sortValue: Math.max(chartMap.get(key)?.sortValue || 0, callDate.getTime()),
      })
    })

    const ratingValues = ratingsInPeriod.map((rating) => Number(rating.rating || rating.nota || 0)).filter(Boolean)
    const averageRating = ratingValues.length ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length : 0

    return {
      summary: {
        totalChats: chatsInPeriod.length,
        totalCalls: callsInPeriod.length,
        totalEmployees: employees.length,
        averageRating,
        botResolved: chatsInPeriod.filter((chat) => chat.botResolved).length,
        inactiveChats: chatsInPeriod.filter((chat) => chat.closedBy === 'employee_inactivity' || chat.closedBy === 'client_inactivity' || chat.closedBy === 'inactivity_employee' || chat.closedBy === 'inactivity_client').length,
        abandoned: chatsInPeriod.filter((chat) => chat.closedBy === 'client').length,
        lostCalls: callsInPeriod.filter((call) => call.status === 'missed').length,
      },
      chartData: Array.from(chartMap.values()).sort((a, b) => a.sortValue - b.sortValue),
      employeeRanking: employees
        .map((employee) => ({
          id: employee.id,
          name: employee.name || employee.email || 'Funcionário',
          totalChats: employee.totalChats || 0,
          totalCalls: employee.totalCalls || 0,
        }))
        .sort((a, b) => b.totalChats + b.totalCalls - (a.totalChats + a.totalCalls)),
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!company?.id) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    let latestChats: any[] = []
    let latestCalls: any[] = []
    let latestEmployees: any[] = []
    let latestRatings: any[] = []

    const syncDashboard = () => {
      setData(buildAnalytics(period, latestChats, latestCalls, latestEmployees, latestRatings))
      setLoading(false)
    }

    const unsubscribers = [
      onSnapshot(query(collection(db, 'chats'), where('companyId', '==', company.id)), (snapshot) => {
        latestChats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any))
        syncDashboard()
      }),
      onSnapshot(query(collection(db, 'calls'), where('companyId', '==', company.id)), (snapshot) => {
        latestCalls = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any))
        syncDashboard()
      }),
      onSnapshot(query(collection(db, 'employees'), where('companyId', '==', company.id)), (snapshot) => {
        latestEmployees = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any))
        syncDashboard()
      }),
      onSnapshot(query(collection(db, 'ratings'), where('companyId', '==', company.id)), (snapshot) => {
        latestRatings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as any))
        syncDashboard()
      }),
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [authLoading, company?.id, period])

  const stats = useMemo(
    () => [
      { label: 'Chats', value: data?.summary?.totalChats || 0, icon: MessageSquare },
      { label: 'Ligações', value: data?.summary?.totalCalls || 0, icon: Phone },
      { label: 'Equipe', value: data?.summary?.totalEmployees || 0, icon: Users },
      { label: 'Nota média', value: Number(data?.summary?.averageRating || 0).toFixed(1), icon: Star },
    ],
    [data]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard operacional</h1>
          <p className="mt-2 text-sm text-muted-foreground">Todos os números abaixo são puxados do Firebase da sua empresa.</p>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-[180px]" data-testid="dashboard-period-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="24h">Últimas 24h</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <Card key={item.label} className="glass border-border/80">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold" data-testid={`dashboard-stat-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>{item.value}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-white">
                    <item.icon className="h-6 w-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {company?.premiumVerificationActive ? null : (
            <Card className="glass border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" />Plano de selo verificado</div>
                  <h2 className="mt-2 text-2xl font-bold">Ganhe mais confiança com o selo premium por R$ 49/mês</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Sem o selo, sua empresa pode perder autoridade visual, gerar objeção no primeiro contato e converter menos. Com o plano, o nome ganha destaque e transmite mais segurança.</p>
                </div>
                <Button asChild className="bg-gradient-primary" data-testid="dashboard-verified-plan-link-button">
                  <Link href="/dashboard/verified-plan">Ver plano verificado</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle>Volume por período</CardTitle>
                <CardDescription>Chats e ligações criadas no período selecionado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]" data-testid="dashboard-live-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.chartData || []}>
                      <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                      <YAxis stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '1rem' }} />
                      <Area type="monotone" dataKey="chats" stroke="var(--chart-1)" fill="rgba(37,99,235,0.2)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="calls" stroke="var(--chart-2)" fill="rgba(56,189,248,0.2)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle>Indicadores úteis</CardTitle>
                <CardDescription>Resumo real da operação da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ['Resolvidos pelo BOT', data?.summary?.botResolved || 0],
                  ['Encerrados por inatividade', data?.summary?.inactiveChats || 0],
                  ['Abandonos', data?.summary?.abandoned || 0],
                  ['Ligações perdidas', data?.summary?.lostCalls || 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Badge variant="outline">{value}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Ranking da equipe</CardTitle>
              <CardDescription>Baseado na produção acumulada no Firestore.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]" data-testid="dashboard-ranking-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.employeeRanking || []}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '1rem' }} />
                    <Bar dataKey="totalChats" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="totalCalls" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}