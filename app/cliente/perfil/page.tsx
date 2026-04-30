'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DeleteAccountCard } from '@/components/account/delete-account-card'
import Link from 'next/link'
import { Clock3, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { toast } from 'sonner'

function toDate(value: any) {
  if (!value) return new Date(0)
  if (typeof value?.toDate === 'function') return value.toDate()
  return new Date(value)
}

function getInitials(name?: string) {
  return (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function PerfilPage() {
  const { user, userData } = useAuth()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.uid) return
      setLoading(true)
      try {
        const [chatsSnap, callsSnap] = await Promise.all([
          getDocs(query(collection(db, 'chats'), where('clientId', '==', user.uid))),
          getDocs(query(collection(db, 'calls'), where('clientId', '==', user.uid))),
        ])

        const rows = [
          ...chatsSnap.docs.map((item) => ({
            id: item.id,
            type: 'chat',
            title: item.data().companyName || 'Empresa',
            subtitle: item.data().subject || item.data().lastMessage || 'Atendimento por chat',
            status: item.data().status,
            date: toDate(item.data().lastMessageAt || item.data().createdAt),
            href: `/cliente/chat/${item.id}`,
          })),
          ...callsSnap.docs.map((item) => ({
            id: item.id,
            type: 'call',
            title: item.data().companyName || 'Ligação',
            subtitle: item.data().protocolo || 'Ligação de voz',
            status: item.data().status,
            date: toDate(item.data().createdAt),
            href: `/cliente/call/${item.id}`,
          })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime())

        setHistory(rows)
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [user?.uid])

  const summary = useMemo(
    () => ({
      total: history.length,
      chats: history.filter((item) => item.type === 'chat').length,
      calls: history.filter((item) => item.type === 'call').length,
    }),
    [history]
  )

  if (!userData || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.uid) return
    setUploading(true)
    try {
      const fileRef = ref(storage, `users/${user.uid}/profile-${Date.now()}-${file.name}`)
      await uploadBytes(fileRef, file)
      const photoURL = await getDownloadURL(fileRef)
      await updateDoc(doc(db, 'users', user.uid), { photoURL })
      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL })
      toast.success('Foto de perfil atualizada.')
    } catch {
      toast.error('Não foi possível enviar a foto agora.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="client-profile-page">
      <div className="rounded-[2rem] border border-border bg-card/70 p-6 shadow-[0_24px_60px_-38px_rgba(37,99,235,0.35)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={userData.photoURL} />
              <AvatarFallback className="bg-gradient-primary text-white">{getInitials(userData.fullName || userData.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{userData.fullName || userData.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Perfil real do cliente conectado.</p>
              <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-input px-3 py-1 text-xs font-medium">
                {uploading ? 'Enviando foto...' : 'Enviar foto de perfil'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="client-profile-photo-input" />
              </label>
            </div>
          </div>
          <Button asChild variant="outline" data-testid="client-profile-settings-link">
            <Link href="/cliente/configuracoes">Editar perfil</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Total de atendimentos', summary.total],
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

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid h-auto grid-cols-3 gap-2">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="contato">Contato</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Dados da conta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Nome completo</p>
                <p className="font-medium">{userData.fullName || userData.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium">{userData.cpf || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gênero</p>
                <p className="font-medium">{userData.gender || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Canal preferido</p>
                <p className="font-medium">{userData.preferredContactChannel || 'chat'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contato">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Contato e verificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" /> Email</div>
                <p className="mt-2 font-medium">{userData.email}</p>
                <Badge className={userData.emailVerified ? 'mt-3 bg-emerald-500/15 text-emerald-400' : 'mt-3 bg-amber-500/15 text-amber-400'}>
                  {userData.emailVerified ? 'Email verificado' : 'Email pendente'}
                </Badge>
              </div>
              <div className="rounded-3xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /> Telefone</div>
                <p className="mt-2 font-medium">{userData.phone || 'Não informado'}</p>
                <Badge className={userData.phoneVerified ? 'mt-3 bg-emerald-500/15 text-emerald-400' : 'mt-3 bg-amber-500/15 text-amber-400'}>
                  {userData.phoneVerified ? 'Telefone verificado' : 'Telefone pendente'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card className="glass border-border/80">
            <CardHeader>
              <CardTitle>Histórico de atendimentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Nenhum atendimento registrado ainda.
                </div>
              ) : (
                history.map((item) => (
                  <Link key={`${item.type}-${item.id}`} href={item.href} data-testid={`client-profile-history-${item.type}-${item.id}`}>
                    <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card/60 p-4 transition hover:border-primary/60">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.status || item.type}</Badge>
                        <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Clock3 className="h-3.5 w-3.5" />{item.date.toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteAccountCard
        title="Apagar conta do cliente"
        description="Remova permanentemente seu acesso e os dados principais do seu perfil na plataforma."
        testIdPrefix="client-profile-delete-account"
      />
    </div>
  )
}