'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowUpRight, BadgeCheck, Landmark, QrCode, ReceiptText, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

async function parseResponseSafely(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: text || 'response-not-json' }
  }
}

export default function VerifiedPlanPage() {
  const { company, refreshUserData, user } = useAuth()
  const companyAny = company as any
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  const sessionId = searchParams.get('session_id')
  const cancelled = searchParams.get('cancelled')

  useEffect(() => {
    if (!sessionId || !user) return

    let cancelledState = false
    setCheckingSession(true)

    const run = async () => {
      try {
        const token = await user.getIdToken(true)
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const response = await fetch(`/api/subscriptions/verified/status/${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await parseResponseSafely(response)
          if (!response.ok) throw new Error(data.error || 'verified-status-failed')

          if (data.paid) {
            if (!cancelledState) {
              await refreshUserData()
              toast.success('Plano verificado ativado com sucesso!')
            }
            break
          }

          if (data.status === 'expired') {
            if (!cancelledState) {
              toast.error('A sessão de pagamento expirou. Tente novamente.')
            }
            break
          }

          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      } catch (error: any) {
        if (!cancelledState) toast.error(error?.message || 'Não foi possível confirmar o pagamento agora.')
      } finally {
        if (!cancelledState) setCheckingSession(false)
      }
    }

    run()
    return () => {
      cancelledState = true
    }
  }, [refreshUserData, sessionId, user])

  const startCheckout = async () => {
    if (!user) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    setLoading(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch('/api/subscriptions/verified/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ origin: window.location.origin }),
      })
      const data = await parseResponseSafely(response)
      if (!response.ok) throw new Error(data.error || 'verified-plan-create-failed')
      window.location.href = data.url
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível iniciar o pagamento do plano agora.')
    } finally {
      setLoading(false)
    }
  }

  const openBillingPortal = async () => {
    if (!user) {
      toast.error('Sua sessão ainda não carregou. Tente novamente em instantes.')
      return
    }

    setOpeningPortal(true)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch('/api/subscriptions/verified/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ origin: window.location.origin }),
      })
      const data = await parseResponseSafely(response)
      if (!response.ok) throw new Error(data.error || 'verified-plan-portal-failed')
      window.location.href = data.url
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível abrir o portal da assinatura agora.')
    } finally {
      setOpeningPortal(false)
    }
  }

  if (company?.premiumVerificationActive) {
    return (
      <div className="space-y-6">
        <Card className="glass border-border/80">
          <CardContent className="flex flex-col items-start gap-4 p-8">
            <Badge className="bg-emerald-500/15 text-emerald-400"><BadgeCheck className="mr-2 h-4 w-4" />Selo verificado ativo</Badge>
            <div>
              <h1 className="text-3xl font-bold">Sua empresa já está com o selo verificado</h1>
              <p className="mt-2 text-sm text-muted-foreground">O selo premium já está ativo no nome da empresa e melhora a confiança no perfil público.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={openBillingPortal} disabled={openingPortal} data-testid="verified-plan-open-portal-button">
                {openingPortal ? 'Abrindo portal...' : 'Gerenciar assinatura'}
              </Button>
              {companyAny?.premiumVerificationCustomerId ? (
                <Badge variant="outline" data-testid="verified-plan-customer-id-badge">Assinatura Kiwify vinculada</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="glass border-border/80">
        <CardHeader>
          <Badge className="w-fit bg-primary/10 text-primary">Plano exclusivo para empresas</Badge>
          <CardTitle className="text-3xl">Selo verificado no nome por R$ 49/mês</CardTitle>
          <CardDescription>Mostre mais confiança, ganhe destaque e reduza a insegurança de novos clientes ao entrar no seu perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {cancelled ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">Pagamento cancelado. Quando quiser, você pode retomar e ativar o selo.</div> : null}
          {checkingSession ? <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">Confirmando o status do seu pagamento...</div> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Sem o plano</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>- Menor confiança ao lado do nome da empresa</li>
                <li>- Menos destaque na percepção pública do perfil</li>
                <li>- Mais objeções de clientes na primeira interação</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 font-semibold text-emerald-400"><ShieldCheck className="h-4 w-4" />Com o plano</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>- Selo verificado premium ao lado do nome</li>
                <li>- Mais autoridade e confiança visual</li>
                <li>- Melhor posicionamento comercial da empresa</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/60 p-4"><TrendingUp className="mb-3 h-5 w-5 text-primary" /><p className="font-medium">Mais conversão</p><p className="mt-1 text-sm text-muted-foreground">Reduz a desconfiança de novos clientes.</p></div>
            <div className="rounded-2xl border border-border bg-card/60 p-4"><BadgeCheck className="mb-3 h-5 w-5 text-primary" /><p className="font-medium">Destaque visual</p><p className="mt-1 text-sm text-muted-foreground">O selo aparece ao lado do nome da empresa.</p></div>
            <div className="rounded-2xl border border-border bg-card/60 p-4"><Sparkles className="mb-3 h-5 w-5 text-primary" /><p className="font-medium">Plano recorrente</p><p className="mt-1 text-sm text-muted-foreground">Cobrança mensal por Pix, boleto ou cartão.</p></div>
          </div>

          <Button onClick={startCheckout} disabled={loading} className="w-full bg-gradient-primary" data-testid="verified-plan-start-checkout-button">
            {loading ? 'Abrindo checkout...' : 'Ir para pagamento do selo'}
            {!loading ? <ArrowUpRight className="ml-2 h-4 w-4" /> : null}
          </Button>
          <p className="text-xs text-muted-foreground">Pagamento seguro pela Kiwify. A ativação do selo acontece automaticamente quando a compra for aprovada.</p>
        </CardContent>
      </Card>

      <Card className="glass border-border/80">
        <CardHeader>
          <Badge className="w-fit bg-emerald-500/10 text-emerald-400">Checkout brasileiro</Badge>
          <CardTitle className="text-2xl">Ative o selo em poucos minutos</CardTitle>
          <CardDescription>O pagamento abre em uma página segura e, após aprovação, o selo aparece automaticamente no perfil público da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plano mensal</p>
                <p className="mt-1 text-4xl font-bold">R$ 49</p>
              </div>
              <Badge className="bg-primary/15 text-primary">Selo premium</Badge>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <QrCode className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Pix</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <ReceiptText className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Boleto</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <Landmark className="mb-3 h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Cartão</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div>
                <p className="font-medium">Liberação automática</p>
                <p className="mt-1 text-sm text-muted-foreground">A confirmação da compra atualiza o status da empresa no sistema.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Mais confiança no perfil</p>
                <p className="mt-1 text-sm text-muted-foreground">O selo reforça a autoridade da empresa nas páginas públicas.</p>
              </div>
            </div>
          </div>

          <Button onClick={startCheckout} disabled={loading} variant="outline" className="w-full" data-testid="verified-plan-secondary-checkout-button">
            {loading ? 'Abrindo checkout...' : 'Abrir checkout da Kiwify'}
            {!loading ? <ArrowUpRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
