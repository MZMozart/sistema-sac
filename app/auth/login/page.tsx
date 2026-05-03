'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { firebaseEnvReady } from '@/lib/firebase'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock, Loader2, RefreshCw } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signInWithGoogle, verifyTwoFactorLogin } = useAuth()
  const [showGoogleType, setShowGoogleType] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [isDesktopShell, setIsDesktopShell] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setIsDesktopShell(typeof window !== 'undefined' && Boolean((window as any).desktopShell?.isDesktop))
    const params = new URLSearchParams(window.location.search)
    if (params.get('googleAuthError') === 'storage') {
      toast.error('NÃ£o foi possÃ­vel concluir o login Google neste navegador. Tente novamente ou entre com email e senha.')
      router.replace('/auth/login')
    }
  }, [router])

  const handleRefreshApp = () => {
    window.location.reload()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Preencha todos os campos')
      return
    }

    setLoading(true)
    try {
      const result = await signIn(email, password, keepSignedIn)
      if ((result as any)?.requiresTwoFactor) {
        setTwoFactorRequired(true)
        toast.success('Senha validada. Agora informe o código do autenticador.')
        return
      }

      toast.success('Login realizado com sucesso!')
    } catch (error: any) {
      console.error('Erro no login:', error)
      if (error.code === 'auth/user-not-found') {
        toast.error('Usuário não encontrado')
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Senha incorreta')
      } else if (error.code === 'auth/invalid-credential') {
        toast.error('Credenciais inválidas')
      } else {
        toast.error('Erro ao fazer login. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async (type: 'pf' | 'pj') => {
    if (!firebaseEnvReady) {
      toast.error('Firebase não configurado na Vercel. Cadastre as variáveis NEXT_PUBLIC_FIREBASE_* antes de usar o login Google.')
      return
    }

    setLoading(true)
    try {
      const result = await signInWithGoogle(type)
      if ((result as any)?.requiresTwoFactor) {
        setTwoFactorRequired(true)
        toast.success('Conta autenticada. Agora informe o código do autenticador.')
        return
      }

      toast.success('Login realizado com sucesso!')
    } catch (error: any) {
      console.error('Erro no login com Google:', error)
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelado')
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup bloqueado pelo navegador. Permita popups para este site e tente novamente.')
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('O domínio atual ainda não foi autorizado no Firebase para login Google.')
      } else if (error.code === 'auth/web-storage-unavailable' || String(error.message || '').includes('missing initial state')) {
        toast.error('O navegador do aplicativo bloqueou o armazenamento necessário para o Google. Tente novamente ou entre com email e senha.')
      } else {
        toast.error('Erro ao fazer login com Google')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFactorCode.trim()) {
      toast.error('Digite o código de 6 dígitos do seu autenticador.')
      return
    }

    setLoading(true)
    try {
      await verifyTwoFactorLogin(twoFactorCode)
      toast.success('2FA validado com sucesso!')
    } catch (error: any) {
      if (error?.status >= 500) {
        toast.error('Falha no servidor do 2FA. Verifique a credencial Firebase Admin da Vercel.')
      } else if (error?.message === 'missing-auth-token') {
        toast.error('Sua sessão expirou. Faça login novamente.')
      } else {
        toast.error('Código 2FA inválido ou expirado.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cabeçalho */}
      <header className="app-fixed-header fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border">
        <div className="container mx-auto flex min-h-16 items-center justify-between px-4">
          <div className="w-10" />
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            {isDesktopShell ? (
              <Button type="button" variant="ghost" size="icon" onClick={handleRefreshApp} aria-label="Atualizar sistema" title="Atualizar sistema" data-testid="login-desktop-refresh-button">
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="app-main-offset safe-page-x flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="border-border bg-card/80 backdrop-blur-sm animate-scale-in">
            <CardHeader className="text-center space-y-2 pb-2">
              <CardTitle className="text-2xl font-bold">Bem-vindo de volta</CardTitle>
              <CardDescription>
                Entre na sua conta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Login com Google */}
              <Button
                variant="outline"
                className="w-full h-12 text-base gap-3 border-border hover:bg-secondary btn-press"
                onClick={() => setShowGoogleType(true)}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar com Google
              </Button>

              {/* Seleção do tipo de conta no Google */}
              {showGoogleType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-card p-6 rounded-lg w-full max-w-sm space-y-4">
                    <h2 className="text-lg font-semibold">Você é:</h2>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={async () => {
                          setShowGoogleType(false)
                          await handleGoogleSignIn('pf')
                        }}
                        disabled={loading}
                        className="w-full"
                      >
                        Cliente
                      </Button>
                      <Button
                        onClick={async () => {
                          setShowGoogleType(false)
                          await handleGoogleSignIn('pj')
                        }}
                        disabled={loading}
                        className="w-full"
                      >
                        Empresa
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={() => setShowGoogleType(false)} className="w-full">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    ou continue com email
                  </span>
                </div>
              </div>

              {/* Formulário de e-mail e senha */}
              {!twoFactorRequired ? <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-secondary/50 border-border focus-ring"
                      disabled={loading}
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Senha
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-secondary/50 border-border focus-ring"
                      disabled={loading}
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/30 p-3 text-sm" htmlFor="keep-signed-in">
                  <Checkbox
                    id="keep-signed-in"
                    checked={keepSignedIn}
                    onCheckedChange={(value) => setKeepSignedIn(Boolean(value))}
                    disabled={loading}
                    data-testid="login-keep-signed-in-checkbox"
                  />
                  <span>
                    <span className="block font-medium">Manter logado</span>
                    <span className="block text-xs text-muted-foreground">Ao fechar e abrir o app novamente, sua sessão continua ativa até você clicar em sair.</span>
                  </span>
                </label>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press"
                  disabled={loading}
                  data-testid="login-submit-button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form> : (
                <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                    Abra o <strong>Google Authenticator</strong> ou <strong>2FAS Auth</strong> e informe o código atual para concluir o login.
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="twoFactorCode" className="text-sm font-medium">
                      Código do autenticador
                    </label>
                    <Input
                      id="twoFactorCode"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-12 bg-secondary/50 border-border focus-ring text-center tracking-[0.35em]"
                      disabled={loading}
                      data-testid="login-twofactor-code-input"
                    />
                  </div>
                  <Button type="submit" className="w-full h-12 text-base bg-gradient-primary hover:opacity-90 glow btn-press" disabled={loading} data-testid="login-twofactor-submit-button">
                    {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" />Validando...</> : 'Validar código 2FA'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => { setTwoFactorRequired(false); setTwoFactorCode('') }} disabled={loading}>
                    Voltar para login
                  </Button>
                </form>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Ainda não tem conta?{' '}
                <Link href="/auth/register" className="text-primary hover:underline font-medium">
                  Criar conta
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Elementos decorativos */}
      <div className="fixed top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  )
}
