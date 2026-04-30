'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BadgeCheck, CreditCard, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function detectCardBrand(cardNumber: string) {
  const clean = cardNumber.replace(/\D/g, '')
  if (/^4/.test(clean)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard'
  if (/^3[47]/.test(clean)) return 'American Express'
  if (/^6(?:011|5)/.test(clean)) return 'Discover'
  if (/^(5067|509|650|651|655)/.test(clean)) return 'Elo'
  if (/^(636368|438935|504175|451416|636297)/.test(clean)) return 'Hipercard'
  return 'Cartão'
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function formatCvv(value: string) {
  return value.replace(/\D/g, '').slice(0, 3)
}

function formatHolderName(value: string) {
  return value.slice(0, 25).toUpperCase()
}

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
  const [cardForm, setCardForm] = useState({
    holderName: company?.nomeFantasia || '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  })

  const sessionId = searchParams.get('session_id')
  const cancelled = searchParams.get('cancelled')
  const cardBrand = useMemo(() => detectCardBrand(cardForm.cardNumber), [cardForm.cardNumber])

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
                <Badge variant="outline" data-testid="verified-plan-customer-id-badge">Cliente Stripe vinculado</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
            <div className="rounded-2xl border border-border bg-card/60 p-4"><Sparkles className="mb-3 h-5 w-5 text-primary" /><p className="font-medium">Plano recorrente</p><p className="mt-1 text-sm text-muted-foreground">Cobrança mensal segura via cartão.</p></div>
          </div>

          <Button onClick={startCheckout} disabled={loading} className="w-full bg-gradient-primary" data-testid="verified-plan-start-checkout-button">
            {loading ? 'Abrindo pagamento seguro...' : 'Assinar selo verificado'}
          </Button>
          <p className="text-xs text-muted-foreground">Pagamento seguro com cartão nacional ou internacional via Stripe Checkout.</p>
        </CardContent>
      </Card>

      <Card className="glass border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Pré-visualização do cartão</CardTitle>
          <CardDescription>O preenchimento abaixo é uma pré-visualização visual do cartão. O pagamento real acontece com segurança na etapa Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-[0.24em] text-white/70">{cardBrand}</span>
              <Badge className="bg-white/10 text-white">R$ 49/mês</Badge>
            </div>
            <div className="mt-8 text-2xl tracking-[0.3em]">{cardForm.cardNumber || '0000 0000 0000 0000'}</div>
            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Nome</p>
                <p className="mt-1 text-sm font-medium uppercase">{cardForm.holderName || 'SEU NOME'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Validade</p>
                <p className="mt-1 text-sm font-medium">{cardForm.expiry || '00/00'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">CVV</p>
                <p className="mt-1 text-sm font-medium">{cardForm.cvv || '000'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase" placeholder="NOME NO CARTÃO" value={cardForm.holderName} onChange={(e) => setCardForm((current) => ({ ...current, holderName: formatHolderName(e.target.value) }))} maxLength={25} data-testid="verified-plan-card-holder-input" />
            <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="0000 0000 0000 0000" value={cardForm.cardNumber} onChange={(e) => setCardForm((current) => ({ ...current, cardNumber: formatCardNumber(e.target.value) }))} inputMode="numeric" maxLength={19} data-testid="verified-plan-card-number-input" />
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="00/00" value={cardForm.expiry} onChange={(e) => setCardForm((current) => ({ ...current, expiry: formatExpiry(e.target.value) }))} inputMode="numeric" maxLength={5} data-testid="verified-plan-card-expiry-input" />
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="000" value={cardForm.cvv} onChange={(e) => setCardForm((current) => ({ ...current, cvv: formatCvv(e.target.value) }))} inputMode="numeric" maxLength={3} data-testid="verified-plan-card-cvv-input" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}