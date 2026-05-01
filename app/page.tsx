'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { LandingHeader } from '@/components/layout/landing-header'
import { LandingFooter } from '@/components/layout/landing-footer'
import { HeroSection } from '@/components/landing/hero-section'
import { FeatureGrid } from '@/components/landing/feature-grid'
import { ScrollShowcase } from '@/components/landing/scroll-showcase'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    const isElectron = typeof (window as any).desktopShell !== 'undefined'

    if (isStandalone || isElectron) {
      router.replace('/auth/login')
    }
  }, [router])

  return (
    <div className="mesh-background min-h-screen overflow-hidden">
      <LandingHeader />

      <main className="landing-main-offset safe-page-x mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10">
        <HeroSection />
        <FeatureGrid />
        <ScrollShowcase />
        <section className="rounded-[2.5rem] border border-border/80 bg-card/55 px-6 py-10 text-center backdrop-blur-2xl md:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Pronto para começar</p>
          <h2 className="mt-4 text-3xl font-bold sm:text-5xl">Coloque cliente, atendente e gestão na mesma operação.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted-foreground">Na web você apresenta o produto. No app e no desktop sua equipe entra direto para atender clientes, acompanhar ligações, ver relatórios e operar sem fricção.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground" data-testid="landing-bottom-primary-cta">
              <Link href="/auth/register">Criar empresa <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" data-testid="landing-bottom-secondary-cta">
              <Link href="/auth/login">Entrar no painel</Link>
            </Button>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
