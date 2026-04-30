'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { AuthService } from '@/services/auth-service'
import { createNotification } from '@/lib/notifications'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { DeleteAccountCard } from '@/components/account/delete-account-card'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Building2,
  Clock,
  Bell,
  Shield,
  Save,
  Upload,
  Globe,
  Mail,
  Phone,
  MapPin,
  Loader2,
  Palette,
  Bot,
  Users,
  Volume2,
} from 'lucide-react'

async function optimizeImageAsDataUrl(file: File, maxWidth: number, maxHeight: number, quality = 0.86) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie um arquivo de imagem válido.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível processar a imagem.'))
    img.src = dataUrl
  })

  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível preparar a imagem.')
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL('image/webp', quality)
}

export default function SettingsPage() {
  const { company, userData, employee, user, refreshUserData } = useAuth()
  const companyAny = company as any
  const currentRole = (employee?.role || userData?.role || 'owner') as 'owner' | 'manager' | 'employee'
  const currentPermissions: any = employee?.permissions || {}
  const [loading, setLoading] = useState(false)
  const [recentNotifications, setRecentNotifications] = useState<any[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false)

  const [companyData, setCompanyData] = useState({
    ownerFullName: userData?.fullName || userData?.name || '',
    nomeFantasia: company?.nomeFantasia || '',
    razaoSocial: company?.razaoSocial || '',
    cnpj: company?.cnpj || '',
    email: company?.email || '',
    phone: company?.phone || '',
    website: company?.website || '',
    instagram: companyAny?.instagram || '',
    facebook: companyAny?.facebook || '',
    whatsapp: companyAny?.whatsapp || '',
    linkedin: companyAny?.linkedin || '',
    cep: company?.cep || '',
    segmento: company?.segmento || '',
    address: company?.address || '',
  })

  const [schedule, setSchedule] = useState({
    horarioInicio: company?.horarioInicio || '08:00',
    horarioFim: company?.horarioFim || '18:00',
    horarioAlmocoInicio: company?.horarioAlmocoInicio || '12:00',
    horarioAlmocoFim: company?.horarioAlmocoFim || '13:00',
    diasFuncionamento: company?.diasFuncionamento || [1, 2, 3, 4, 5],
  })

  const [notifications, setNotifications] = useState({
    emailNewChat: true,
    emailNewCall: true,
    emailDailyReport: true,
    pushNotifications: true,
    soundAlerts: true,
  })

  const [branding, setBranding] = useState({
    logoURL: company?.logoURL || '',
    bannerURL: companyAny?.bannerURL || '',
    corPrimaria: company?.corPrimaria || '#2563eb',
    corDestaque: company?.corDestaque || '#38bdf8',
  })

  const [integrations, setIntegrations] = useState({
    webhookUrl: companyAny?.settings?.webhookUrl || '',
    crmUrl: companyAny?.settings?.crmUrl || '',
    callbackUrl: companyAny?.settings?.callbackUrl || '',
    publicApiTokenLabel: companyAny?.settings?.publicApiTokenLabel || '',
  })

  const [audioSettings, setAudioSettings] = useState({
    callVolume: Number(companyAny?.settings?.audioSettings?.callVolume ?? 100),
    botVoiceVolume: Number(companyAny?.settings?.audioSettings?.botVoiceVolume ?? 100),
    inputDeviceId: companyAny?.settings?.audioSettings?.inputDeviceId || 'default',
    outputDeviceId: companyAny?.settings?.audioSettings?.outputDeviceId || 'default',
  })
  const [audioDevices, setAudioDevices] = useState<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }>({ inputs: [], outputs: [] })

  const [permissions, setPermissions] = useState<any>(companyAny?.permissions || {
    owner: ['all'],
    manager: ['reports', 'team', 'basic_settings'],
    employee: ['chats', 'calls', 'tickets'],
  })

  const [chatbotSettings, setChatbotSettings] = useState({
    botName: company?.botName || 'AtendePro Bot',
    botGreeting: company?.botGreeting || 'Olá! Sou o assistente virtual da empresa. Como posso ajudar?',
    botOutOfHours: company?.botOutOfHours || 'Nosso atendimento está fora do horário no momento. Deixe sua mensagem e retornaremos assim que possível.',
    botActive: company?.botActive ?? true,
  })

  const [security, setSecurity] = useState({
    newPassword: '',
    confirmPassword: '',
    twoFactorAuth: Boolean(userData?.twoFactorEnabled),
  })
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  const [accountSettings, setAccountSettings] = useState({
    fullName: userData?.fullName || userData?.name || '',
    email: userData?.email || '',
    phone: userData?.phone || '',
    address: userData?.address || '',
  })

  const diasSemana = [
    { value: 0, label: 'Dom' },
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
  ]

  const toggleDia = (dia: number) => {
    setSchedule((prev) => ({
      ...prev,
      diasFuncionamento: prev.diasFuncionamento.includes(dia)
        ? prev.diasFuncionamento.filter((d) => d !== dia)
        : [...prev.diasFuncionamento, dia].sort(),
    }))
  }

  useEffect(() => {
    if (!company || !userData) return

    setCompanyData({
      ownerFullName: userData?.fullName || userData?.name || '',
      nomeFantasia: company?.nomeFantasia || '',
      razaoSocial: company?.razaoSocial || '',
      cnpj: company?.cnpj || '',
      email: company?.email || userData?.email || '',
      phone: company?.phone || userData?.phone || '',
      website: company?.website || '',
      instagram: companyAny?.instagram || '',
      facebook: companyAny?.facebook || '',
      whatsapp: companyAny?.whatsapp || '',
      linkedin: companyAny?.linkedin || '',
      cep: company?.cep || '',
      segmento: company?.segmento || '',
      address: company?.address || '',
    })

    setSchedule({
      horarioInicio: company?.horarioInicio || '08:00',
      horarioFim: company?.horarioFim || '18:00',
      horarioAlmocoInicio: company?.horarioAlmocoInicio || '12:00',
      horarioAlmocoFim: company?.horarioAlmocoFim || '13:00',
      diasFuncionamento: company?.diasFuncionamento || [1, 2, 3, 4, 5],
    })

    setNotifications({
      emailNewChat: companyAny?.notificationSettings?.emailNewChat ?? true,
      emailNewCall: companyAny?.notificationSettings?.emailNewCall ?? true,
      emailDailyReport: companyAny?.notificationSettings?.emailDailyReport ?? true,
      pushNotifications: companyAny?.notificationSettings?.pushNotifications ?? true,
      soundAlerts: companyAny?.notificationSettings?.soundAlerts ?? true,
    })

    setBranding({
      logoURL: company?.logoURL || '',
      bannerURL: companyAny?.bannerURL || '',
      corPrimaria: company?.corPrimaria || '#2563eb',
      corDestaque: company?.corDestaque || '#38bdf8',
    })

    setIntegrations({
      webhookUrl: companyAny?.settings?.webhookUrl || '',
      crmUrl: companyAny?.settings?.crmUrl || '',
      callbackUrl: companyAny?.settings?.callbackUrl || '',
      publicApiTokenLabel: companyAny?.settings?.publicApiTokenLabel || '',
    })

    setAudioSettings({
      callVolume: Number(companyAny?.settings?.audioSettings?.callVolume ?? 100),
      botVoiceVolume: Number(companyAny?.settings?.audioSettings?.botVoiceVolume ?? 100),
      inputDeviceId: companyAny?.settings?.audioSettings?.inputDeviceId || 'default',
      outputDeviceId: companyAny?.settings?.audioSettings?.outputDeviceId || 'default',
    })

    setPermissions(companyAny?.permissions || {
      owner: ['all'],
      manager: ['reports', 'team', 'basic_settings'],
      employee: ['chats', 'calls', 'tickets'],
    })

    setChatbotSettings({
      botName: company?.botName || 'AtendePro Bot',
      botGreeting: company?.botGreeting || 'Olá! Sou o assistente virtual da empresa. Como posso ajudar?',
      botOutOfHours: company?.botOutOfHours || 'Nosso atendimento está fora do horário no momento. Deixe sua mensagem e retornaremos assim que possível.',
      botActive: company?.botActive ?? true,
    })

    setSecurity((current) => ({
      ...current,
      twoFactorAuth: Boolean(userData?.twoFactorEnabled),
    }))

    setAccountSettings({
      fullName: userData?.fullName || userData?.name || '',
      email: userData?.email || '',
      phone: userData?.phone || '',
      address: userData?.address || '',
    })
  }, [company, userData])

  useEffect(() => {
    const loadAudioDevices = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setAudioDevices({
          inputs: devices.filter((device) => device.kind === 'audioinput'),
          outputs: devices.filter((device) => device.kind === 'audiooutput'),
        })
      } catch {
        setAudioDevices({ inputs: [], outputs: [] })
      }
    }

    loadAudioDevices()
  }, [])

  useEffect(() => {
    if (!company?.id) return
    const notificationsQuery = query(collection(db, 'notifications'), where('recipientCompanyId', '==', company.id))
    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }))
        .sort((a, b) => {
          const aDate = typeof a.createdAt?.toDate === 'function' ? a.createdAt.toDate().getTime() : 0
          const bDate = typeof b.createdAt?.toDate === 'function' ? b.createdAt.toDate().getTime() : 0
          return bDate - aDate
        })
        .slice(0, 8)
      setRecentNotifications(rows)
    })

    return () => unsubscribe()
  }, [company?.id])

  const togglePermission = (role: 'owner' | 'manager' | 'employee', key: string) => {
    setPermissions((current: any) => {
      const currentRolePermissions = current[role] || []
      const nextRolePermissions = currentRolePermissions.includes(key)
        ? currentRolePermissions.filter((item: string) => item !== key)
        : [...currentRolePermissions, key]

      return { ...current, [role]: nextRolePermissions }
    })
  }

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !company?.id) return

    setUploadingLogo(true)
    try {
      const logoURL = await optimizeImageAsDataUrl(file, 320, 320, 0.92)
      setBranding((current) => ({ ...current, logoURL }))
      await updateDoc(doc(db, 'companies', company.id), { logoURL })
      await refreshUserData()
      toast.success('Logo atualizada com sucesso.')
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar a logo agora.')
    } finally {
      setUploadingLogo(false)
      event.target.value = ''
    }
  }

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !company?.id) return

    setUploadingBanner(true)
    try {
      const bannerURL = await optimizeImageAsDataUrl(file, 1280, 420, 0.82)
      setBranding((current) => ({ ...current, bannerURL }))
      await updateDoc(doc(db, 'companies', company.id), { bannerURL })
      await refreshUserData()
      toast.success('Banner atualizado com sucesso.')
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar o banner agora.')
    } finally {
      setUploadingBanner(false)
      event.target.value = ''
    }
  }

  const handleLookupCompanyByCnpj = async () => {
    const normalized = companyData.cnpj.replace(/\D/g, '')
    if (normalized.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.')
      return
    }

    setLookingUpCnpj(true)
    try {
      const response = await fetch(`/api/company/cnpj-lookup?cnpj=${normalized}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'cnpj-lookup-failed')

      setCompanyData((current) => ({
        ...current,
        razaoSocial: data.razaoSocial || current.razaoSocial,
        nomeFantasia: data.nomeFantasia || current.nomeFantasia,
        email: data.email || current.email,
        phone: data.phone || current.phone,
        cep: data.cep || current.cep,
        address: data.address || current.address,
        segmento: data.segmento || current.segmento,
      }))

      toast.success('Dados da empresa preenchidos automaticamente pelo CNPJ.')
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível puxar os dados da empresa agora.')
    } finally {
      setLookingUpCnpj(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (security.newPassword || security.confirmPassword) {
        if (security.newPassword !== security.confirmPassword) {
          toast.error('A confirmação da nova senha não confere.')
          setLoading(false)
          return
        }

        await AuthService.updatePassword(security.newPassword)
      }

      if (company) {
        const companyUpdates: Record<string, any> = {}

        if (currentRole === 'owner' || currentPermissions.canEditCompanySettings) {
          Object.assign(companyUpdates, {
            ownerFullName: companyData.ownerFullName,
            razaoSocial: companyData.razaoSocial,
            nomeFantasia: companyData.nomeFantasia,
            cnpj: companyData.cnpj,
            email: companyData.email,
            phone: companyData.phone,
            website: companyData.website,
            instagram: companyData.instagram,
            facebook: companyData.facebook,
            whatsapp: companyData.whatsapp,
            linkedin: companyData.linkedin,
            cep: companyData.cep,
            segmento: companyData.segmento,
            address: companyData.address,
            horarioInicio: schedule.horarioInicio,
            horarioFim: schedule.horarioFim,
            horarioAlmocoInicio: schedule.horarioAlmocoInicio,
            horarioAlmocoFim: schedule.horarioAlmocoFim,
            diasFuncionamento: schedule.diasFuncionamento,
            logoURL: branding.logoURL || '',
            bannerURL: branding.bannerURL || '',
            corPrimaria: branding.corPrimaria,
            corDestaque: branding.corDestaque,
          })
        }

        if (currentRole === 'owner' || currentPermissions.canManageIntegrations) {
          companyUpdates.settings = {
            ...(company.settings || {}),
            webhookUrl: integrations.webhookUrl,
            crmUrl: integrations.crmUrl,
            callbackUrl: integrations.callbackUrl,
            publicApiTokenLabel: integrations.publicApiTokenLabel,
            audioSettings,
          }
        }

        if (currentRole === 'owner' || currentPermissions.canEditBotPolicies) {
          Object.assign(companyUpdates, {
            botName: chatbotSettings.botName,
            botGreeting: chatbotSettings.botGreeting,
            botOutOfHours: chatbotSettings.botOutOfHours,
            botActive: chatbotSettings.botActive,
          })
        }

        if (currentRole === 'owner' || currentPermissions.canManagePermissions) {
          companyUpdates.permissions = permissions
        }

        if (currentRole === 'owner') {
          companyUpdates.notificationSettings = notifications
        }

        if (Object.keys(companyUpdates).length > 0) {
          await updateDoc(doc(db, 'companies', company.id), companyUpdates)
          await refreshUserData()
        }

        await createNotification({
          recipientCompanyId: company.id,
          title: 'Configurações atualizadas',
          body: 'Identidade visual, horários, notificações, integrações, permissões e segurança foram salvos.',
          type: 'system',
          actionUrl: '/dashboard/settings',
          entityType: 'settings',
        })
      }
      // Salva dados do usuário (PF)
      if (userData) {
        await updateDoc(doc(db, 'users', userData.uid), {
          name: accountSettings.fullName,
          fullName: accountSettings.fullName,
          email: accountSettings.email,
          phone: accountSettings.phone,
          address: accountSettings.address,
          ...(currentRole === 'owner' ? { notificationSettings: notifications } : {}),
        })
      }
      toast.success('Configurações salvas com sucesso!')
    } catch (error) {
      toast.error('Erro ao salvar configurações')
    } finally {
      setLoading(false)
    }
  }

  const canEditCompanyVisual = currentRole === 'owner' || currentPermissions.canEditCompanySettings
  const canManageIntegrations = currentRole === 'owner' || currentPermissions.canManageIntegrations
  const canManageBot = currentRole === 'owner' || currentPermissions.canEditBotPolicies
  const canManagePermissionsTab = currentRole === 'owner' || currentPermissions.canManagePermissions
  const canViewRatingsAndReports = currentRole === 'owner' || currentPermissions.canViewRatings || currentPermissions.canExportData

  const getAuthToken = async () => {
    if (!user) throw new Error('not-authenticated')
    return user.getIdToken(true)
  }

  const startTwoFactorSetup = async () => {
    setTwoFactorLoading(true)
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/twofactor/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'twofactor-setup-failed')
      setTwoFactorSetup({ qrCodeDataUrl: data.qrCodeDataUrl, secret: data.secret })
      toast.success('QR Code gerado. Escaneie com Google Authenticator ou 2FAS Auth.')
    } catch {
      toast.error('Não foi possível iniciar o 2FA agora.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const confirmTwoFactorSetup = async () => {
    setTwoFactorLoading(true)
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/twofactor/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: twoFactorCode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'twofactor-verify-failed')
      setSecurity((current) => ({ ...current, twoFactorAuth: true }))
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      toast.success('2FA ativado com sucesso.')
    } catch {
      toast.error('Código 2FA inválido ou expirado.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const disableTwoFactor = async () => {
    setTwoFactorLoading(true)
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/twofactor/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: twoFactorDisableCode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'twofactor-disable-failed')
      setSecurity((current) => ({ ...current, twoFactorAuth: false }))
      setTwoFactorDisableCode('')
      toast.success('2FA desativado com sucesso.')
    } catch {
      toast.error('Não foi possível desativar o 2FA com esse código.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold">Configurações</h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">Gerencie as configurações da sua empresa</p>
      </div>

      <Tabs defaultValue={currentRole === 'owner' ? 'company' : 'account'} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {currentRole !== 'owner' ? (
            <TabsTrigger value="account" className="gap-2">
              <Users className="w-4 h-4" />
              <span>Minha conta</span>
            </TabsTrigger>
          ) : null}
          {canEditCompanyVisual ? (
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span>Empresa</span>
            </TabsTrigger>
          ) : null}
          {canEditCompanyVisual ? (
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="w-4 h-4" />
              <span>Identidade Visual</span>
            </TabsTrigger>
          ) : null}
          {canEditCompanyVisual ? (
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="w-4 h-4" />
              <span>Horários</span>
            </TabsTrigger>
          ) : null}
          {currentRole === 'owner' ? (
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              <span>Notificações</span>
            </TabsTrigger>
          ) : null}
          {canManageIntegrations ? (
            <TabsTrigger value="integrations" className="gap-2">
              <Globe className="w-4 h-4" />
              <span>Integrações</span>
            </TabsTrigger>
          ) : null}
          {canManageBot ? (
            <TabsTrigger value="chatbot" className="gap-2">
              <Bot className="w-4 h-4" />
              <span>Chatbot</span>
            </TabsTrigger>
          ) : null}
          {canManagePermissionsTab ? (
            <TabsTrigger value="permissions" className="gap-2">
              <Users className="w-4 h-4" />
              <span>Permissões</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            <span>Segurança</span>
          </TabsTrigger>
        </TabsList>

        {currentRole !== 'owner' ? (
          <TabsContent value="account" className="space-y-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Minha conta</CardTitle>
                <CardDescription>Edite seus dados pessoais sem alterar a empresa.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome completo</Label>
                  <Input value={accountSettings.fullName} onChange={(e) => setAccountSettings({ ...accountSettings, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={accountSettings.email} onChange={(e) => setAccountSettings({ ...accountSettings, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={accountSettings.phone} onChange={(e) => setAccountSettings({ ...accountSettings, phone: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={accountSettings.address} onChange={(e) => setAccountSettings({ ...accountSettings, address: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canEditCompanyVisual ? <TabsContent value="company" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Dados da Empresa
              </CardTitle>
              <CardDescription>Informações principais do seu negócio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome completo do dono</Label>
                  <Input
                    value={companyData.ownerFullName}
                    onChange={(e) => setCompanyData({ ...companyData, ownerFullName: e.target.value })}
                    placeholder="Responsável principal pela empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input
                    value={companyData.razaoSocial}
                    onChange={(e) => setCompanyData({ ...companyData, razaoSocial: e.target.value })}
                    placeholder="Razão Social da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={companyData.nomeFantasia}
                    onChange={(e) => setCompanyData({ ...companyData, nomeFantasia: e.target.value })}
                    placeholder="Como é conhecido"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={companyData.cnpj}
                      onChange={(e) => setCompanyData({ ...companyData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                    <Button type="button" variant="outline" onClick={handleLookupCompanyByCnpj} disabled={lookingUpCnpj} data-testid="settings-cnpj-autofill-button">
                      {lookingUpCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preencher'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Opcional: puxa razão social, nome fantasia, telefone, CEP, endereço e segmento automaticamente.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </Label>
                  <Input
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={companyData.cep}
                    onChange={(e) => setCompanyData({ ...companyData, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Input
                    value={companyData.segmento}
                    onChange={(e) => setCompanyData({ ...companyData, segmento: e.target.value })}
                    placeholder="Ex: E-commerce, Saúde, Educação"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    E-mail
                  </Label>
                  <Input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Website
                  </Label>
                  <Input
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    placeholder="https://empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={companyData.instagram} onChange={(e) => setCompanyData({ ...companyData, instagram: e.target.value })} placeholder="https://instagram.com/suaempresa" />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input value={companyData.facebook} onChange={(e) => setCompanyData({ ...companyData, facebook: e.target.value })} placeholder="https://facebook.com/suaempresa" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={companyData.whatsapp} onChange={(e) => setCompanyData({ ...companyData, whatsapp: e.target.value })} placeholder="https://wa.me/5511999999999" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={companyData.linkedin} onChange={(e) => setCompanyData({ ...companyData, linkedin: e.target.value })} placeholder="https://linkedin.com/company/suaempresa" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Endereço
                </Label>
                <Input
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  placeholder="Rua, número, cidade - estado"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {canEditCompanyVisual ? <TabsContent value="branding" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Identidade Visual
              </CardTitle>
              <CardDescription>Personalize a aparência do seu sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 overflow-hidden rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-secondary/50">
                    {branding.logoURL ? <img src={branding.logoURL} alt="Logo da empresa" className="h-full w-full object-cover" /> : <Building2 className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground">
                    <Upload className="w-4 h-4" />
                    {uploadingLogo ? 'Processando logo...' : 'Enviar Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} data-testid="settings-branding-logo-input" />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máx 2MB. Recomendado: 200x200px</p>
              </div>
              <div className="space-y-2">
                <Label>URL da Logo</Label>
                <Input value={branding.logoURL} onChange={(e) => setBranding({ ...branding, logoURL: e.target.value })} placeholder="https://..." data-testid="settings-branding-logo-url" />
              </div>
              <div className="space-y-3">
                <Label>Banner da Empresa</Label>
                <div className="aspect-[2.4/1] overflow-hidden rounded-2xl border border-border bg-secondary/40 flex items-center justify-center">
                  {branding.bannerURL ? <img src={branding.bannerURL} alt="Banner da empresa" className="h-full w-full object-cover" /> : <span className="text-sm text-muted-foreground">Sem banner configurado</span>}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent hover:text-accent-foreground">
                  <Upload className="w-4 h-4" />
                  {uploadingBanner ? 'Processando banner...' : 'Enviar Banner'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} data-testid="settings-branding-banner-input" />
                </label>
                <Input value={branding.bannerURL} onChange={(e) => setBranding({ ...branding, bannerURL: e.target.value })} placeholder="https://..." data-testid="settings-branding-banner-url" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={branding.corPrimaria} onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-border" />
                    <Input value={branding.corPrimaria} onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })} className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de Destaque</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={branding.corDestaque} onChange={(e) => setBranding({ ...branding, corDestaque: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-border" />
                    <Input value={branding.corDestaque} onChange={(e) => setBranding({ ...branding, corDestaque: e.target.value })} className="font-mono" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {canEditCompanyVisual ? <TabsContent value="schedule" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horário de Atendimento
              </CardTitle>
              <CardDescription>Defina quando sua equipe está disponível</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Dias de Funcionamento</Label>
                <div className="flex flex-wrap gap-2">
                  {diasSemana.map((dia) => (
                    <button
                      key={dia.value}
                      type="button"
                      onClick={() => toggleDia(dia.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        schedule.diasFuncionamento.includes(dia.value)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Início do Atendimento</Label>
                  <Input
                    type="time"
                    value={schedule.horarioInicio}
                    onChange={(e) => setSchedule({ ...schedule, horarioInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim do Atendimento</Label>
                  <Input
                    type="time"
                    value={schedule.horarioFim}
                    onChange={(e) => setSchedule({ ...schedule, horarioFim: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Início do Almoço</Label>
                  <Input
                    type="time"
                    value={schedule.horarioAlmocoInicio}
                    onChange={(e) => setSchedule({ ...schedule, horarioAlmocoInicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim do Almoço</Label>
                  <Input
                    type="time"
                    value={schedule.horarioAlmocoFim}
                    onChange={(e) => setSchedule({ ...schedule, horarioAlmocoFim: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {currentRole === 'owner' ? <TabsContent value="notifications" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Configurações de Notificações
              </CardTitle>
              <CardDescription>Escolha como você quer ser notificado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'emailNewChat', label: 'E-mail para novo chat', description: 'Receba um e-mail quando um novo chat for iniciado' },
                { key: 'emailNewCall', label: 'E-mail para nova ligação', description: 'Receba um e-mail quando uma nova ligação chegar' },
                { key: 'emailDailyReport', label: 'Relatório diário por e-mail', description: 'Receba um resumo diário de atendimentos' },
                { key: 'pushNotifications', label: 'Notificações push', description: 'Receba notificações no navegador em tempo real' },
                { key: 'soundAlerts', label: 'Alertas sonoros', description: 'Toque um som ao receber novos atendimentos' },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof typeof notifications]}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, [key]: checked })
                    }
                  />
                </div>
              ))}

              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="mb-3 text-sm font-medium">Últimas notificações do sistema</p>
                <div className="space-y-2">
                  {recentNotifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma notificação real registrada ainda.</p>
                  ) : recentNotifications.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-background/70 p-3 text-sm" data-testid={`settings-notification-${item.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{item.type}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {canManageIntegrations ? <TabsContent value="integrations" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Integrações
              </CardTitle>
              <CardDescription>Conecte o sistema com outras ferramentas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook de eventos</Label>
                <Input value={integrations.webhookUrl} onChange={(e) => setIntegrations({ ...integrations, webhookUrl: e.target.value })} placeholder="https://seu-endpoint.com/webhook" data-testid="settings-integrations-webhook" />
              </div>
              <div className="space-y-2">
                <Label>URL do CRM/ERP</Label>
                <Input value={integrations.crmUrl} onChange={(e) => setIntegrations({ ...integrations, crmUrl: e.target.value })} placeholder="https://crm.empresa.com/api" data-testid="settings-integrations-crm" />
              </div>
              <div className="space-y-2">
                <Label>Callback público</Label>
                <Input value={integrations.callbackUrl} onChange={(e) => setIntegrations({ ...integrations, callbackUrl: e.target.value })} placeholder="https://empresa.com/retorno" data-testid="settings-integrations-callback" />
              </div>
              <div className="space-y-2">
                <Label>Identificador do token público</Label>
                <Input value={integrations.publicApiTokenLabel} onChange={(e) => setIntegrations({ ...integrations, publicApiTokenLabel: e.target.value })} placeholder="Ex: portal-site-principal" data-testid="settings-integrations-token-label" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Áudio da plataforma
              </CardTitle>
              <CardDescription>Defina entrada, saída e volumes padrão para ligações e voz do bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Entrada de áudio</Label>
                  <select value={audioSettings.inputDeviceId} onChange={(e) => setAudioSettings({ ...audioSettings, inputDeviceId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="settings-audio-input-device">
                    <option value="default">Padrão do sistema</option>
                    {audioDevices.inputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${device.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Saída de áudio</Label>
                  <select value={audioSettings.outputDeviceId} onChange={(e) => setAudioSettings({ ...audioSettings, outputDeviceId: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" data-testid="settings-audio-output-device">
                    <option value="default">Padrão do sistema</option>
                    {audioDevices.outputs.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Saída ${device.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Label>Volume da chamada</Label>
                  <span>{audioSettings.callVolume}%</span>
                </div>
                <input type="range" min="0" max="150" step="5" value={audioSettings.callVolume} onChange={(e) => setAudioSettings({ ...audioSettings, callVolume: Number(e.target.value) })} className="w-full" data-testid="settings-audio-call-volume" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Label>Volume da voz do bot</Label>
                  <span>{audioSettings.botVoiceVolume}%</span>
                </div>
                <input type="range" min="0" max="150" step="5" value={audioSettings.botVoiceVolume} onChange={(e) => setAudioSettings({ ...audioSettings, botVoiceVolume: Number(e.target.value) })} className="w-full" data-testid="settings-audio-bot-volume" />
              </div>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {canManageBot ? <TabsContent value="chatbot" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Configurações do Chatbot
              </CardTitle>
              <CardDescription>Configure o comportamento do seu bot de atendimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Bot</Label>
                <Input value={chatbotSettings.botName} onChange={(e) => setChatbotSettings({ ...chatbotSettings, botName: e.target.value })} placeholder="Nome do seu assistente virtual" />
              </div>
              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea
                  value={chatbotSettings.botGreeting}
                  onChange={(e) => setChatbotSettings({ ...chatbotSettings, botGreeting: e.target.value })}
                  placeholder="Mensagem inicial do bot..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem quando fora do horário</Label>
                <Textarea
                  value={chatbotSettings.botOutOfHours}
                  onChange={(e) => setChatbotSettings({ ...chatbotSettings, botOutOfHours: e.target.value })}
                  placeholder="Mensagem fora do horário..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-sm">Bot ativo</p>
                  <p className="text-xs text-muted-foreground">Ativar ou desativar o bot de atendimento</p>
                </div>
                <Switch checked={chatbotSettings.botActive} onCheckedChange={(checked) => setChatbotSettings({ ...chatbotSettings, botActive: checked })} />
              </div>
              <Button asChild variant="outline" data-testid="settings-chatbot-advanced-link">
                <Link href="/dashboard/bot">Abrir configuração avançada do BOT</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent> : null}

        {canManagePermissionsTab ? <TabsContent value="permissions" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Permissões da Equipe
              </CardTitle>
              <CardDescription>Defina o que cada perfil pode fazer no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { role: 'owner', title: 'Proprietário', description: 'Acesso completo à operação.' },
                { role: 'manager', title: 'Gerente', description: 'Coordena equipe, filas e relatórios.' },
                { role: 'employee', title: 'Atendente', description: 'Atende clientes por chat e ligação.' },
              ].map((roleItem) => (
                <div key={roleItem.role} className="rounded-lg border border-border p-4 space-y-3">
                  <div>
                    <p className="font-medium">{roleItem.title}</p>
                    <p className="text-sm text-muted-foreground">{roleItem.description}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['reports', 'Relatórios'],
                      ['team', 'Equipe'],
                      ['basic_settings', 'Configurações'],
                      ['chats', 'Chats'],
                      ['calls', 'Ligações'],
                      ['tickets', 'Tickets'],
                    ].map(([key, label]) => (
                      <div key={`${roleItem.role}-${key}`} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
                        <span className="text-sm">{label}</span>
                        <Switch checked={(permissions[roleItem.role] || []).includes(key)} onCheckedChange={() => togglePermission(roleItem.role as 'owner' | 'manager' | 'employee', key)} data-testid={`settings-permission-${roleItem.role}-${key}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent> : null}

        <TabsContent value="security" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Segurança
              </CardTitle>
              <CardDescription>Configurações de segurança da conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input type="password" value={security.newPassword} onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <Input type="password" value={security.confirmPassword} onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-sm">Autenticação de dois fatores</p>
                  <p className="text-xs text-muted-foreground">Compatível com Google Authenticator e 2FAS Auth</p>
                </div>
                <Switch checked={security.twoFactorAuth} onCheckedChange={(checked) => {
                  if (checked) {
                    startTwoFactorSetup()
                  } else {
                    setSecurity({ ...security, twoFactorAuth: false })
                  }
                }} />
              </div>
              {twoFactorSetup ? (
                <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium">Escaneie o QR Code no Google Authenticator ou 2FAS Auth</p>
                  <img src={twoFactorSetup.qrCodeDataUrl} alt="QR Code do 2FA" className="h-48 w-48 rounded-xl border border-border bg-white p-2" data-testid="twofactor-qr-image" />
                  <div className="rounded-xl border border-border bg-background/80 p-3 text-xs text-muted-foreground break-all">Chave manual: {twoFactorSetup.secret}</div>
                  <Input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Digite o código de 6 dígitos" inputMode="numeric" data-testid="twofactor-setup-code-input" />
                  <Button type="button" onClick={confirmTwoFactorSetup} disabled={twoFactorLoading || twoFactorCode.length < 6} data-testid="twofactor-setup-confirm-button">
                    {twoFactorLoading ? 'Validando...' : 'Confirmar ativação do 2FA'}
                  </Button>
                </div>
              ) : null}
              {security.twoFactorAuth ? (
                <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium">Desativar autenticação de dois fatores</p>
                  <Input value={twoFactorDisableCode} onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Informe o código atual do autenticador" inputMode="numeric" data-testid="twofactor-disable-code-input" />
                  <Button type="button" variant="outline" onClick={disableTwoFactor} disabled={twoFactorLoading || twoFactorDisableCode.length < 6} data-testid="twofactor-disable-button">
                    {twoFactorLoading ? 'Desativando...' : 'Desativar 2FA'}
                  </Button>
                </div>
              ) : null}
              <Button variant="outline" className="w-full" disabled>
                A nova senha será aplicada ao salvar as configurações
              </Button>
              <DeleteAccountCard
                title="Apagar conta da plataforma"
                description="Use esta opção para remover definitivamente sua conta. Para donos, a empresa e os dados operacionais vinculados também serão apagados."
                testIdPrefix="settings-delete-account"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-gradient-primary hover:opacity-90 glow btn-press gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
