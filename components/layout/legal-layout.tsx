import type { ReactNode } from 'react'
import { LandingHeader } from '@/components/layout/landing-header'
import { LandingFooter } from '@/components/layout/landing-footer'

export function LegalLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="mesh-background min-h-screen overflow-hidden">
      <LandingHeader />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 md:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-border/80 bg-card/65 p-8 shadow-[0_24px_70px_-42px_rgba(37,99,235,0.35)] backdrop-blur-2xl md:p-12">
          <div className="mb-10 space-y-4 text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
            <p className="text-base leading-7 text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-8 text-sm leading-8 text-muted-foreground">{children}</div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}