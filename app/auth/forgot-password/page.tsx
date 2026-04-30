'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      toast.success('Email de recuperação enviado com sucesso.')
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível enviar o email de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mesh-background min-h-screen overflow-hidden">
      <header className="glass-strong fixed inset-x-0 top-0 z-50 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/auth/login" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground" data-testid="forgot-password-back-link">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
          <Logo size="sm" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 pt-24">
        <Card className="glass-strong w-full max-w-lg rounded-[2rem] border-border shadow-[0_24px_120px_-48px_rgba(15,23,42,0.4)]">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_18px_40px_-20px_rgba(37,99,235,0.55)]">
              <MailCheck className="h-7 w-7" />
            </div>
            <CardTitle className="text-3xl">Recuperar acesso</CardTitle>
            <CardDescription>
              Informe o email da conta. Vamos enviar o link para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-password-email">Email</Label>
                <Input
                  id="forgot-password-email"
                  type="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12"
                  data-testid="forgot-password-email-input"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary" disabled={loading} data-testid="forgot-password-submit-button">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar email de recuperação
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}