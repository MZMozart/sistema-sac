'use client'

import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export function LandingHeader() {
  return (
    <header className="glass-strong fixed inset-x-0 top-0 z-50 border-b border-border/80">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
        <Logo size="sm" />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="/#recursos" className="transition-colors hover:text-foreground" data-testid="landing-nav-recursos">Recursos</Link>
          <Link href="/#experiencia" className="transition-colors hover:text-foreground" data-testid="landing-nav-experiencia">Experiência</Link>
          <Link href="/#seguranca" className="transition-colors hover:text-foreground" data-testid="landing-nav-seguranca">Segurança</Link>
          <Link href="/contato" className="transition-colors hover:text-foreground" data-testid="landing-nav-contato">Contato</Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="outline" className="hidden sm:inline-flex" data-testid="landing-header-login">
            <Link href="/auth/login">Entrar</Link>
          </Button>
          <Button asChild className="bg-gradient-primary text-primary-foreground" data-testid="landing-header-register">
            <Link href="/auth/register">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}