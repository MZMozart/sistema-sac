'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, AudioLines, Bot, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div>
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Plataforma global de atendimento
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }} className="max-w-4xl text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-7xl">
          Atendimento multiempresa com chat, voz, BOT, equipe e gestão centralizados.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }} className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
          Um sistema completo para empresas que precisam atender clientes com agilidade, manter histórico, distribuir a equipe, medir desempenho e evoluir a operação com dados reais.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground" data-testid="hero-primary-cta">
            <Link href="/auth/register">Criar conta <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" data-testid="hero-secondary-cta">
            <Link href="/auth/login">Entrar no sistema</Link>
          </Button>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24 }} className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Bot, title: 'BOT por empresa', text: 'Cada empresa configura textos, ações, horários e transferências próprias.' },
            { icon: AudioLines, title: 'Voz ao vivo', text: 'Ligação em tempo real entre cliente e equipe direto no sistema.' },
            { icon: ShieldCheck, title: 'Operação segura', text: 'Equipe, auditoria, permissões e relatórios executivos em uma base única.' },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-border bg-card/55 p-4 backdrop-blur-xl">
              <item.icon className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.94, rotateY: -8 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative [perspective:1800px]">
        <div className="absolute -left-8 top-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-8 right-10 h-52 w-52 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative rounded-[2.2rem] border border-border/80 bg-slate-950/70 p-5 shadow-[0_30px_80px_-34px_rgba(37,99,235,0.55)] backdrop-blur-2xl [transform:rotateX(8deg)_rotateY(-12deg)]">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border/70 bg-card/65 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">AtendePro Command Center</p>
              <p className="text-xs text-muted-foreground">Chat, voz, avaliações, equipe e indicadores em uma única operação.</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-400">Live</span>
          </div>
          <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3 rounded-3xl border border-border/70 bg-card/60 p-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-primary">Fila ativa</p>
                <p className="mt-3 text-3xl font-bold">12</p>
              </div>
              <div className="rounded-2xl bg-card/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">CSAT</p>
                <p className="mt-3 text-2xl font-bold">4.9/5</p>
              </div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-card/60 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {['Chat em tempo real', 'Voz WebRTC', 'Permissões', 'Relatórios exportáveis'].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-border/60 bg-slate-900/70 p-4" style={{ transform: `translateZ(${18 + index * 6}px)` }}>
                    <p className="font-semibold text-foreground">{item}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Fluxos reais para cliente, gerente, funcionário e liderança.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}