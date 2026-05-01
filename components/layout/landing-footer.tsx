import Link from 'next/link'
import { Download, MonitorDown, Smartphone } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

const WINDOWS_DOWNLOAD_URL = 'https://github.com/MZMozart/sistema-sac/releases/latest/download/AtendePro-0.1.0-win-x64.exe'
const ANDROID_DOWNLOAD_URL = 'https://github.com/MZMozart/sistema-sac/releases/latest/download/AtendePro-Android-debug.apk'

export function LandingFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/30 pb-10 pt-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] md:px-8">
        <div className="space-y-4">
          <Logo size="sm" />
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            Plataforma premium para atendimento multiempresa com chat, voz, BOT, analytics e operação real.
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button asChild className="h-11 justify-center gap-2">
              <a href={WINDOWS_DOWNLOAD_URL} download>
                <MonitorDown className="h-4 w-4" />
                Baixar para PC
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 justify-center gap-2">
              <a href={ANDROID_DOWNLOAD_URL} download>
                <Smartphone className="h-4 w-4" />
                Baixar Android
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
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
