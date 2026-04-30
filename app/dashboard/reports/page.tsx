'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '@/contexts/auth-context'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, Loader2, TrendingUp, Users, Phone, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

function getAverage(items: number[]) {
  if (items.length === 0) return 0
  return Number((items.reduce((sum, value) => sum + value, 0) / items.length).toFixed(1))
}

export default function ReportsPage() {
  const { company, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<any>(null)

  const loadExport = async () => {
    if (!company?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [companySnap, chatsSnap, callsSnap, employeesSnap, ratingsSnap] = await Promise.all([
        getDocs(query(collection(db, 'companies'), where('ownerId', '==', company.ownerId || company.id))).then((snap) => snap),
        getDocs(query(collection(db, 'chats'), where('companyId', '==', company.id))),
        getDocs(query(collection(db, 'calls'), where('companyId', '==', company.id))),
        getDocs(query(collection(db, 'employees'), where('companyId', '==', company.id))),
        getDocs(query(collection(db, 'ratings'), where('companyId', '==', company.id))),
      ])

      const companyDoc = companySnap.docs.find((item) => item.id === company.id)
      setPayload({
        exportedAt: new Date().toISOString(),
        company: companyDoc ? { id: companyDoc.id, ...companyDoc.data() } : company,
        chats: chatsSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
        calls: callsSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
        employees: employeesSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
        ratings: ratingsSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
      })
    } catch {
      toast.error('Não foi possível gerar o relatório real da empresa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    loadExport()
  }, [authLoading, company?.id])

  const metrics = useMemo(() => {
    const employees = payload?.employees || []
    const chats = payload?.chats || []
    const calls = payload?.calls || []
    const ratings = payload?.ratings || []
    const managers = employees.filter((item: any) => item.role === 'manager')
    const attendants = employees.filter((item: any) => item.role === 'attendant' || item.role === 'employee')
    const activeChats = chats.filter((item: any) => item.status !== 'closed').length
    const averageRating = getAverage(ratings.map((item: any) => Number(item.rating || 0)).filter(Boolean))

    return {
      employees: employees.length,
      managers: managers.length,
      attendants: attendants.length,
      chats: chats.length,
      activeChats,
      calls: calls.length,
      ratings: ratings.length,
      averageRating,
    }
  }, [payload])

  const improvementPoints = useMemo(() => {
    if (!payload) return []
    const employees = payload.employees || []
    const chats = payload.chats || []
    const calls = payload.calls || []
    const ratings = payload.ratings || []

    const points = []
    if (chats.filter((item: any) => item.status === 'waiting').length > 0) {
      points.push('Existem chats aguardando humano. Vale ajustar fila, distribuição e escala do time.')
    }
    if (calls.filter((item: any) => item.status === 'waiting').length > 0) {
      points.push('Há ligações aguardando atendimento. Reforce cobertura ou roteamento no período de pico.')
    }
    if (ratings.length > 0 && getAverage(ratings.map((item: any) => Number(item.rating || 0)).filter(Boolean)) < 4) {
      points.push('A média de avaliações está abaixo de 4. Priorize feedbacks recentes e treinamento de atendimento.')
    }
    if (employees.length < 2) {
      points.push('A empresa opera com equipe enxuta. Adicionar gerente/atendentes reduz gargalos e concentração de demanda.')
    }
    if (points.length === 0) {
      points.push('Operação equilibrada no momento. Continue acompanhando avaliações, tempo de resposta e volume por colaborador.')
    }
    return points
  }, [payload])

  const employeeRows = useMemo(() => {
    const employees = payload?.employees || []
    return employees.map((employee: any) => ({
      name: employee.name || employee.fullName || employee.email || 'Funcionário',
      role: employee.role || 'attendant',
      chats: employee.totalChats || 0,
      calls: employee.totalCalls || 0,
    }))
  }, [payload])

  const downloadPdf = () => {
    if (!payload) return

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const companyName = payload.company?.nomeFantasia || payload.company?.razaoSocial || 'Empresa'
    const generatedAt = new Date(payload.exportedAt).toLocaleString('pt-BR')

    doc.setFontSize(22)
    doc.text(`Relatório Executivo — ${companyName}`, 40, 48)
    doc.setFontSize(10)
    doc.text(`Atualizado em ${generatedAt}`, 40, 66)

    doc.setFontSize(13)
    doc.text('Resumo operacional', 40, 96)
    autoTable(doc, {
      startY: 106,
      head: [['Indicador', 'Valor']],
      body: [
        ['Funcionários', String(metrics.employees)],
        ['Gerentes', String(metrics.managers)],
        ['Atendentes', String(metrics.attendants)],
        ['Chats totais', String(metrics.chats)],
        ['Chats ativos', String(metrics.activeChats)],
        ['Ligações', String(metrics.calls)],
        ['Avaliações', String(metrics.ratings)],
        ['Média das avaliações', String(metrics.averageRating || '-')],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
    })

    const lastY = (doc as any).lastAutoTable?.finalY || 280
    doc.text('Desempenho da equipe', 40, lastY + 26)
    autoTable(doc, {
      startY: lastY + 36,
      head: [['Nome', 'Cargo', 'Chats', 'Ligações']],
      body: employeeRows.length > 0 ? employeeRows.map((row: any) => [row.name, row.role, String(row.chats), String(row.calls)]) : [['Sem dados', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [15, 118, 110] },
    })

    const nextY = (doc as any).lastAutoTable?.finalY || lastY + 180
    doc.text('Pontos de melhoria', 40, nextY + 26)
    improvementPoints.forEach((point, index) => {
      doc.text(`• ${point}`, 50, nextY + 48 + index * 18)
    })

    doc.save(`relatorio-${companyName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  return (
    <div className="space-y-6" data-testid="dashboard-reports-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios executivos</h1>
          <p className="mt-2 text-sm text-muted-foreground">Painel com desempenho real da empresa, equipe, chats, ligações e pontos de melhoria.</p>
        </div>
        <Button onClick={downloadPdf} disabled={!payload} data-testid="reports-download-pdf-button">
          <Download className="mr-2 h-4 w-4" />
          Baixar PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Funcionários', value: metrics.employees, icon: Users },
              { label: 'Chats ativos', value: metrics.activeChats, icon: MessageSquare },
              { label: 'Ligações', value: metrics.calls, icon: Phone },
              { label: 'Média CSAT', value: metrics.averageRating || '-', icon: TrendingUp },
            ].map((item) => (
              <Card key={item.label} className="glass border-border/80">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold">{item.value}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-white"><item.icon className="h-5 w-5" /></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle>Resumo do relatório</CardTitle>
                <CardDescription>Conteúdo que também segue para o PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                  <span>Empresa</span>
                  <Badge variant="outline">{payload?.company?.nomeFantasia || payload?.company?.razaoSocial || 'Sem nome'}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                  <span>Segmento</span>
                  <Badge variant="outline">{payload?.company?.segmento || 'Não informado'}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                  <span>Última atualização</span>
                  <Badge variant="outline">{payload?.exportedAt ? new Date(payload.exportedAt).toLocaleString('pt-BR') : '-'}</Badge>
                </div>
                <div className="rounded-3xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                  <div className="mb-3 flex items-center gap-2 font-medium text-foreground"><FileText className="h-4 w-4 text-primary" /> O PDF inclui</div>
                  <ul className="space-y-2">
                    <li>• resumo geral da operação</li>
                    <li>• desempenho de funcionários e gerentes</li>
                    <li>• indicadores úteis para melhoria contínua</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle>Pontos de melhoria</CardTitle>
                <CardDescription>Leitura executiva para liderança repassar ao time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {improvementPoints.map((point) => (
                  <div key={point} className="rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                    {point}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}