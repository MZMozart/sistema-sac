'use client'

import { useMemo, useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { Bell, Loader2, MailCheck, Save, ShieldCheck, Smartphone, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AuthService } from '@/services/auth-service'
import { db } from '@/lib/firebase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/phone-input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { ConfirmationResult } from 'firebase/auth'

type ClientGender = 'masculino' | 'feminino' | 'nao-binario' | 'prefiro-nao-informar' | 'outro'
type ClientChannel = 'chat' | 'email' | 'phone'

export default function ClienteConfiguracoesPage() {
  const { userData, refreshUserData } = useAuth()
  const recaptchaRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [smsCode, setSmsCode] = useState('')

  const [profile, setProfile] = useState({
    name: userData?.name || userData?.fullName || '',
    email: userData?.email || '',
    phone: userData?.phone || '',
    fullPhone: userData?.phone || '',
    gender: (userData?.gender as ClientGender) || 'prefiro-nao-informar',
    cep: userData?.cep || '',
    address: userData?.address || '',
    preferredContactChannel: (userData?.preferredContactChannel as ClientChannel) || 'chat',
  })

  const [notifications, setNotifications] = useState({
    responses: Boolean(userData?.notificationPreferences?.responses?.length),
    messages: Boolean(userData?.notificationPreferences?.newMessages?.length),
    tickets: Boolean(userData?.notificationPreferences?.ticketUpdates?.length),
  })

  const [security, setSecurity] = useState({ newPassword: '', confirmPassword: '' })

  const completion = useMemo(() => {
    const required = [profile.name, profile.email, profile.phone, profile.address]
    return Math.round((required.filter(Boolean).length / required.length) * 100)
  }, [profile])

  if (!userData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const saveProfile = async () => {
    setLoading(true)
    try {
      if (profile.email !== userData.email) {
        await AuthService.updateEmail(profile.email)
      }

      await updateDoc(doc(db, 'users', userData.uid), {
        name: profile.name,
        fullName: profile.name,
        email: profile.email,
        phone: profile.fullPhone,
        gender: profile.gender,
        cep: profile.cep,
        address: profile.address,
        preferredContactChannel: profile.preferredContactChannel,
      })

      await refreshUserData()
      toast.success('Perfil do cliente atualizado com sucesso.')
    } catch (error) {
      toast.error('Não foi possível salvar o perfil agora.')
    } finally {
      setLoading(false)
    }
  }

  const saveNotifications = async () => {
    setLoading(true)
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        notificationPreferences: {
          responses: notifications.responses ? ['email'] : [],
          newMessages: notifications.messages ? ['email', 'push'] : [],
          ticketUpdates: notifications.tickets ? ['email'] : [],
        },
      })
      await refreshUserData()
      toast.success('Preferências de notificação salvas.')
    } catch {
      toast.error('Erro ao salvar notificações.')
    } finally {
      setLoading(false)
    }
  }

  const savePassword = async () => {
    if (!security.newPassword || security.newPassword !== security.confirmPassword) {
      toast.error('Confirme a nova senha corretamente.')
      return
    }

    setLoading(true)
    try {
      await AuthService.updatePassword(security.newPassword)
      setSecurity({ newPassword: '', confirmPassword: '' })
      toast.success('Senha atualizada com sucesso.')
    } catch {
      toast.error('Erro ao atualizar a senha.')
    } finally {
      setLoading(false)
    }
  }

  const sendEmailVerification = async () => {
    setLoading(true)
    try {
      await AuthService.sendCurrentEmailVerification()
      toast.success('Email de verificação enviado.')
    } catch {
      toast.error('Não consegui reenviar a verificação de email.')
    } finally {
      setLoading(false)
    }
  }

  const sendPhoneCode = async () => {
    if (!recaptchaRef.current || !profile.fullPhone) {
      toast.error('Informe um telefone válido para verificar.')
      return
    }

    setLoading(true)
    try {
      const result = await AuthService.startPhoneVerification(profile.fullPhone, recaptchaRef.current)
      setConfirmationResult(result)
      toast.success('Código enviado por SMS.')
    } catch {
      toast.error('Não foi possível enviar o código por SMS.')
    } finally {
      setLoading(false)
    }
  }

  const confirmPhone = async () => {
    if (!confirmationResult || !smsCode) {
      toast.error('Informe o código recebido por SMS.')
      return
    }

    setLoading(true)
    try {
      await AuthService.confirmPhoneVerification(confirmationResult, smsCode)
      await refreshUserData()
      setSmsCode('')
      toast.success('Telefone verificado com sucesso.')
    } catch {
      toast.error('Código inválido ou expirado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 px-4 pb-12 pt-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[2rem] border border-border bg-card/70 p-6 shadow-[0_24px_60px_-38px_rgba(37,99,235,0.35)]">
          <h1 className="text-3xl font-bold">Configurações do cliente</h1>
          <p className="mt-2 text-sm text-muted-foreground">Edite seus dados, notificações, segurança e verificação da conta.</p>
          <div className="mt-4 h-3 rounded-full bg-secondary">
            <div className="h-3 rounded-full bg-gradient-primary" style={{ width: `${completion}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Perfil preenchido em {completion}%.</p>
        </div>

        <Tabs defaultValue="perfil" className="space-y-6">
          <TabsList className="grid h-auto grid-cols-2 gap-2 md:grid-cols-4">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="seguranca">Segurança</TabsTrigger>
            <TabsTrigger value="verificacao">Verificação</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil">
            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Perfil do cliente</CardTitle>
                <CardDescription>Atualize os dados visíveis da sua conta.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome completo</Label>
                  <Input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} data-testid="client-settings-name-input" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} data-testid="client-settings-email-input" />
                </div>
                <div className="space-y-2">
                  <Label>Gênero</Label>
                  <Select value={profile.gender} onValueChange={(value) => setProfile((current) => ({ ...current, gender: value as ClientGender }))}>
                    <SelectTrigger data-testid="client-settings-gender-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="nao-binario">Não-binário</SelectItem>
                      <SelectItem value="prefiro-nao-informar">Prefiro não informar</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Telefone</Label>
                  <PhoneInput value={profile.phone} onChange={(value, fullNumber) => setProfile((current) => ({ ...current, phone: value, fullPhone: fullNumber }))} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={profile.cep} onChange={(event) => setProfile((current) => ({ ...current, cep: event.target.value.replace(/\D/g, '') }))} data-testid="client-settings-cep-input" />
                </div>
                <div className="space-y-2">
                  <Label>Canal preferido</Label>
                  <Select value={profile.preferredContactChannel} onValueChange={(value) => setProfile((current) => ({ ...current, preferredContactChannel: value as ClientChannel }))}>
                    <SelectTrigger data-testid="client-settings-channel-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={profile.address} onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))} data-testid="client-settings-address-input" />
                </div>
                <Button onClick={saveProfile} disabled={loading} className="bg-gradient-primary md:col-span-2" data-testid="client-settings-save-profile-button">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar perfil
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notificacoes">
            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notificações</CardTitle>
                <CardDescription>Defina como quer ser avisado sobre respostas e atualizações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'responses', label: 'Respostas do atendimento' },
                  { key: 'messages', label: 'Novas mensagens' },
                  { key: 'tickets', label: 'Atualizações do protocolo' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-4">
                    <span>{item.label}</span>
                    <Switch checked={notifications[item.key as keyof typeof notifications]} onCheckedChange={(value) => setNotifications((current) => ({ ...current, [item.key]: value }))} />
                  </div>
                ))}
                <Button onClick={saveNotifications} disabled={loading} data-testid="client-settings-save-notifications-button">
                  Salvar notificações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seguranca">
            <Card className="glass border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Segurança</CardTitle>
                <CardDescription>Atualize sua senha sempre que necessário.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" value={security.newPassword} onChange={(event) => setSecurity((current) => ({ ...current, newPassword: event.target.value }))} data-testid="client-settings-new-password-input" />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar nova senha</Label>
                  <Input type="password" value={security.confirmPassword} onChange={(event) => setSecurity((current) => ({ ...current, confirmPassword: event.target.value }))} data-testid="client-settings-confirm-password-input" />
                </div>
                <Button onClick={savePassword} disabled={loading} data-testid="client-settings-save-password-button">Atualizar senha</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verificacao">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="glass border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5" /> Verificação de email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Status atual: {userData.emailVerified ? 'verificado' : 'pendente'}</p>
                  <Button onClick={sendEmailVerification} disabled={loading || userData.emailVerified} data-testid="client-settings-send-email-verification-button">
                    Reenviar verificação
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Verificação de telefone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Status atual: {userData.phoneVerified ? 'verificado' : 'pendente'}</p>
                  <div ref={recaptchaRef} id="client-phone-recaptcha" />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" onClick={sendPhoneCode} disabled={loading} data-testid="client-settings-send-sms-button">Enviar código</Button>
                    <Input value={smsCode} onChange={(event) => setSmsCode(event.target.value)} placeholder="Código SMS" data-testid="client-settings-sms-code-input" />
                    <Button onClick={confirmPhone} disabled={loading || !confirmationResult} data-testid="client-settings-confirm-sms-button">Confirmar</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}