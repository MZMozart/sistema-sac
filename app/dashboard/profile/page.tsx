'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { updateProfile } from 'firebase/auth'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { useAuth } from '@/contexts/auth-context'
import { createNotification } from '@/lib/notifications'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteAccountCard } from '@/components/account/delete-account-card'
import { Building2, Bot, ExternalLink, Loader2, Mail, MapPin, Phone, Settings, Shield, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function DashboardProfilePage() {
  const { company, userData } = useAuth()
  const [payload, setPayload] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [accessRequests, setAccessRequests] = useState<any[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      try {
        if (!company?.id) throw new Error('company-not-found')

        const [employeesSnap, chatsSnap, callsSnap, ratingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'employees'), where('companyId', '==', company.id))),
          getDocs(query(collection(db, 'chats'), where('companyId', '==', company.id))),
          getDocs(query(collection(db, 'calls'), where('companyId', '==', company.id))),
          getDocs(query(collection(db, 'ratings'), where('companyId', '==', company.id))),
        ])

        setPayload({
          exportedAt: new Date().toISOString(),
          employees: employeesSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })),
          chats: chatsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })),
          calls: callsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })),
          ratings: ratingsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })),
        })
      } catch {
        toast.error('Não foi possível carregar o perfil completo da empresa.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [company?.id])

  useEffect(() => {
    if (!company?.id) return

    const notificationsQuery = query(collection(db, 'notifications'), where('recipientCompanyId', '==', company.id))
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const requestRows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .filter((item: any) => item.title === 'Solicitação de acesso fora do horário' && !item.readAt)

      setAccessRequests(requestRows)
    })

    return () => unsubscribe()
  }, [company?.id])

  const stats = useMemo(
    () => [
      { label: 'Funcionários', value: payload?.employees?.length || 0, icon: Users },
      { label: 'Chats', value: payload?.chats?.length || 0, icon: Building2 },
      { label: 'Ligações', value: payload?.calls?.length || 0, icon: Phone },
      { label: 'Avaliações', value: payload?.ratings?.length || 0, icon: Shield },
    ],
    [payload]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const uid = auth.currentUser?.uid
    if (!file || !uid) return
    setUploading(true)
    try {
      const fileRef = ref(storage, `users/${uid}/profile-${Date.now()}-${file.name}`)
      await uploadBytes(fileRef, file)
      const photoURL = await getDownloadURL(fileRef)
      await updateDoc(doc(db, 'users', uid), { photoURL })
      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL })
      toast.success('Foto de perfil atualizada.')
    } catch {
      toast.error('Não foi possível enviar a foto agora.')
    } finally {
      setUploading(false)
    }
  }

  const handleAccessDecision = async (request: any, approved: boolean) => {
    try {
      if (approved && request.entityId) {
        await updateDoc(doc(db, 'employees', request.entityId), {
          tempAccessApprovedUntil: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
        })
      }

      await updateDoc(doc(db, 'notifications', request.id), {
        readAt: serverTimestamp(),
        decision: approved ? 'approved' : 'denied',
      })

      await createNotification({
        recipientCompanyId: company?.id,
        recipientUserId: request.targetUserId,
        title: approved ? 'Acesso fora do horário aprovado' : 'Acesso fora do horário negado',
        body: approved
          ? 'A empresa liberou seu acesso temporário por 2 horas.'
          : 'A empresa negou sua solicitação de acesso fora do horário.',
        type: 'system',
        actionUrl: '/dashboard',
        entityId: request.entityId,
        entityType: 'profile',
      })

      setAccessRequests((current) => current.filter((item) => item.id !== request.id))
      toast.success(approved ? 'Acesso temporário liberado.' : 'Solicitação negada.')
    } catch {
      toast.error('Não foi possível registrar a decisão agora.')
    }
  }

  return (
    <div className="space-y-6" data-testid="dashboard-profile-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-3xl border border-border bg-secondary/30">
            {company?.logoURL ? <img src={company.logoURL} alt={company?.nomeFantasia || 'Logo da empresa'} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">{(company?.nomeFantasia || company?.razaoSocial || 'E').charAt(0)}</div>}
          </div>
          <div>
            <h1 className="text-3xl font-bold">Perfil da empresa</h1>
            <p className="mt-2 text-sm text-muted-foreground">Resumo real da empresa, do dono e da operação conectada.</p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-input px-3 py-1 text-xs font-medium">
              {uploading ? 'Enviando foto...' : 'Enviar foto de perfil'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="dashboard-profile-photo-input" />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" data-testid="dashboard-profile-settings-link">
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Editar configurações
            </Link>
          </Button>
          {company?.id ? (
            <Button asChild data-testid="dashboard-profile-public-link">
              <Link href={`/empresa/${company.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver perfil público
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="glass border-border/80">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-bold" data-testid={`dashboard-profile-stat-${item.label.toLowerCase()}`}>{item.value}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${company?.corPrimaria || '#2563eb'}, ${company?.corDestaque || '#38bdf8'})` }}>
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass border-border/80">
          <CardHeader>
            <CardTitle>Identidade e contato</CardTitle>
            <CardDescription>Dados institucionais salvos no Firestore.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card/60 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Empresa</p>
              <p className="mt-2 text-xl font-semibold" data-testid="dashboard-profile-company-name">{company?.nomeFantasia || company?.razaoSocial || 'Empresa sem nome'}</p>
              {company?.segmento ? <p className="mt-1 text-sm text-muted-foreground">{company.segmento}</p> : null}
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> Email</div>
              <p className="mt-3 font-medium">{company?.email || userData?.email || 'Não informado'}</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> Telefone</div>
              <p className="mt-3 font-medium">{company?.phone || userData?.phone || 'Não informado'}</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> Endereço</div>
              <p className="mt-3 font-medium">{company?.address || company?.endereco || 'Endereço ainda não preenchido'}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Solicitações de acesso fora do horário</CardTitle>
              <CardDescription>Libere ou negue acessos excepcionais de gerente/funcionário.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {accessRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Nenhuma solicitação pendente.</div>
              ) : accessRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-border bg-card/60 p-4">
                  <p className="font-medium">{request.actorName || 'Colaborador'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{request.body}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => handleAccessDecision(request, true)} data-testid={`approve-access-${request.id}`}>Permitir 2h</Button>
                    <Button size="sm" variant="outline" onClick={() => handleAccessDecision(request, false)} data-testid={`deny-access-${request.id}`}>Negar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Dono e status</CardTitle>
              <CardDescription>Conta principal da operação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-border bg-card/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Responsável</p>
                <p className="mt-2 font-semibold">{company?.ownerFullName || userData?.fullName || userData?.name || 'Não informado'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{userData?.email || 'Sem email'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{company?.cnpj || 'CNPJ pendente'}</Badge>
                <Badge className={company?.botActive === false ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}>
                  <Bot className="mr-1 h-3 w-3" />
                  {company?.botActive === false ? 'BOT pausado' : 'BOT ativo'}
                </Badge>
                <Badge className={company?.twoFactorAuth ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-300'}>
                  <Shield className="mr-1 h-3 w-3" />
                  {company?.twoFactorAuth ? '2FA ativo' : '2FA inativo'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Preferências operacionais</CardTitle>
              <CardDescription>Estados atuais já persistidos para a empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-sm text-muted-foreground">Horário base</span>
                <span className="font-medium">{company?.horarioInicio || '--:--'} às {company?.horarioFim || '--:--'}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-sm text-muted-foreground">Canal principal</span>
                <span className="font-medium">Chat + Voz</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                <span className="text-sm text-muted-foreground">Última exportação</span>
                <span className="font-medium">{payload?.exportedAt ? new Date(payload.exportedAt).toLocaleString('pt-BR') : 'Ainda não exportado'}</span>
              </div>
            </CardContent>
          </Card>

          <DeleteAccountCard
            title="Encerrar sua conta empresarial"
            description="Se você apagar a conta principal, a empresa e os dados conectados serão removidos da plataforma."
            testIdPrefix="dashboard-profile-delete-account"
          />
        </div>
      </div>
    </div>
  )
}