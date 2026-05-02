'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit'
import { useAuth } from '@/contexts/auth-context'
import { rebalanceChatQueue } from '@/lib/chat-queue'
import { getInitialChatFlowMessage } from '@/lib/bot-flow'
import { isPublicCompany } from '@/lib/public-company'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Loader2, MapPin, Search } from 'lucide-react'
import { toast } from 'sonner'

const categories = ['Problema técnico', 'Cobrança', 'Dúvida', 'Comercial', 'Outro']

function generateProtocol() {
  return `CHT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export default function NewTicketPage() {
  const router = useRouter()
  const { user, userData } = useAuth()
  const [companies, setCompanies] = useState<any[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    companyId: '',
    subject: '',
    category: categories[0],
    priority: 'media',
    message: '',
  })

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'companies'))
        const rows = snapshot.docs
          .map((item: any) => ({ id: item.id, ...item.data() }))
          .filter((item: any) => isPublicCompany(item))
        setCompanies(rows)
        if (rows[0]) {
          setForm((current) => ({ ...current, companyId: current.companyId || rows[0].id }))
        }
      } finally {
        setLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [])

  const selectedCompany = useMemo(() => companies.find((item) => item.id === form.companyId), [companies, form.companyId])
  const filteredCompanies = useMemo(() => {
    const text = companySearch.trim().toLowerCase()
    if (!text) return companies
    return companies.filter((company) =>
      `${company.nomeFantasia || ''} ${company.razaoSocial || ''} ${company.segmento || ''} ${company.city || ''} ${company.state || ''}`.toLowerCase().includes(text)
    )
  }, [companies, companySearch])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !selectedCompany) {
      toast.error('Escolha uma empresa e faça login para continuar.')
      return
    }

    setSaving(true)
    try {
      const protocolo = generateProtocol()
      const initialFlowMessage = getInitialChatFlowMessage(selectedCompany)
      const chatRef = await addDoc(collection(db, 'chats'), {
        protocolo,
        companyId: selectedCompany.id,
        companyName: selectedCompany.nomeFantasia || selectedCompany.razaoSocial,
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        clientEmail: user.email || '',
        category: form.category,
        subject: form.subject,
        priority: form.priority,
        status: 'bot',
        queuePosition: null,
        unreadCount: 0,
        botResolved: false,
        botAttempts: 0,
        botCurrentMessageId: initialFlowMessage?.id || null,
        botAwaitingResolvedConfirmation: false,
        botAwaitingAnythingElse: false,
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      })

      const firstMessage = `${form.subject.trim()}\n\n${form.message.trim()}`.trim()
      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        companyId: selectedCompany.id,
        content: firstMessage,
        type: 'text',
        senderType: 'client',
        senderId: user.uid,
        senderName: userData?.fullName || user.displayName || 'Cliente',
        createdAt: serverTimestamp(),
        read: false,
      })

      await addDoc(collection(db, 'messages'), {
        chatId: chatRef.id,
        companyId: selectedCompany.id,
        content: initialFlowMessage?.text || selectedCompany.botGreeting || `Olá! Recebi seu protocolo ${protocolo} e vou triar seu caso agora.`,
        type: 'text',
        senderType: 'bot',
        senderId: 'bot',
        senderName: `${selectedCompany.nomeFantasia || selectedCompany.razaoSocial} BOT`,
        createdAt: serverTimestamp(),
        read: false,
      })

      await createNotification({
        recipientCompanyId: selectedCompany.id,
        title: 'Novo atendimento criado',
        body: `${userData?.fullName || user.displayName || 'Cliente'} abriu o protocolo ${protocolo}.`,
        type: 'chat',
        actionUrl: `/dashboard/chats?chat=${chatRef.id}`,
        entityId: chatRef.id,
        entityType: 'chat',
        actorName: userData?.fullName || user.displayName || 'Cliente',
      })

      await createAuditLog({
        companyId: selectedCompany.id,
        companyName: selectedCompany.nomeFantasia || selectedCompany.razaoSocial,
        protocol: protocolo,
        chatId: chatRef.id,
        channel: 'chat',
        eventType: 'chat_created',
        clientId: user.uid,
        clientName: userData?.fullName || user.displayName || 'Cliente',
        summary: 'Novo atendimento criado pelo cliente.',
        metadata: { subject: form.subject, category: form.category, priority: form.priority },
      })

      await rebalanceChatQueue(selectedCompany.id)

      router.push(`/cliente/chat/${chatRef.id}`)
    } catch {
      toast.error('Não foi possível criar o atendimento agora.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingCompanies) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="client-new-ticket-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Novo atendimento</h1>
          <p className="mt-2 text-sm text-muted-foreground">Escolha uma empresa da vitrine e abra um protocolo de atendimento.</p>
        </div>
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={companySearch}
            onChange={(event) => setCompanySearch(event.target.value)}
            placeholder="Pesquisar empresa por nome, setor ou cidade"
            className="h-12 pl-11"
            data-testid="client-new-ticket-company-search-input"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredCompanies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhuma empresa pública encontrada.
          </div>
        ) : filteredCompanies.map((company) => {
          const active = company.id === form.companyId
          return (
            <button
              key={company.id}
              type="button"
              onClick={() => setForm((current) => ({ ...current, companyId: company.id }))}
              className={`rounded-3xl border bg-card/70 p-5 text-left transition hover:border-primary/70 ${active ? 'border-primary shadow-[0_20px_60px_-35px_rgba(37,99,235,0.9)]' : 'border-border'}`}
              data-testid={`client-new-ticket-company-card-${company.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{company.nomeFantasia || company.razaoSocial || 'Empresa'}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{company.segmento || 'Atendimento geral'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{[company.city, company.state].filter(Boolean).join(' - ') || company.address || 'Atendimento online'}</span>
              </div>
            </button>
          )
        })}
      </div>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle>{selectedCompany ? `Abrir atendimento com ${selectedCompany.nomeFantasia || selectedCompany.razaoSocial}` : 'Escolha uma empresa para continuar'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Empresa</Label>
              <Select value={form.companyId} onValueChange={(value) => setForm((current) => ({ ...current, companyId: value }))}>
                <SelectTrigger data-testid="client-new-ticket-company-select"><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.nomeFantasia || company.razaoSocial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Assunto</Label>
              <Input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required data-testid="client-new-ticket-subject-input" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                <SelectTrigger data-testid="client-new-ticket-category-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                <SelectTrigger data-testid="client-new-ticket-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Mensagem inicial</Label>
              <Textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required className="min-h-[180px]" data-testid="client-new-ticket-message-input" />
            </div>
            <Button type="submit" disabled={saving || !selectedCompany} className="bg-gradient-primary md:col-span-2" data-testid="client-new-ticket-submit-button">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar atendimento real
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
