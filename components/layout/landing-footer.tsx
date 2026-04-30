import Link from 'next/link'
import { Logo } from '@/components/logo'

export function LandingFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/30 pb-10 pt-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] md:px-8">
        <div className="space-y-4">
          <Logo size="sm" />
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Plataforma premium para atendimento multiempresa com chat, voz, BOT, analytics e operação real.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-foreground">Produto</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <Link href="/#recursos" className="block hover:text-foreground">Recursos</Link>
            <Link href="/#experiencia" className="block hover:text-foreground">Experiência</Link>
            <Link href="/#seguranca" className="block hover:text-foreground">Segurança</Link>
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-foreground">Empresa</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <Link href="/contato" className="block hover:text-foreground">Contato</Link>
            <Link href="/auth/login" className="block hover:text-foreground">Entrar</Link>
            <Link href="/auth/register" className="block hover:text-foreground">Criar conta</Link>
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-foreground">Legal</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <Link href="/termos-de-uso" className="block hover:text-foreground">Termos de Uso</Link>
            <Link href="/privacidade" className="block hover:text-foreground">Privacidade</Link>
            <Link href="/contato" className="block hover:text-foreground">Contato</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}