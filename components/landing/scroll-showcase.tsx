'use client'

import { motion } from 'framer-motion'

export function ScrollShowcase() {
  return (
    <section id="experiencia" className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <h2 className="text-3xl font-bold sm:text-5xl">Atendimento, gestão e melhoria contínua no mesmo ambiente.</h2>
        <p className="mt-4 text-base leading-8 text-muted-foreground">
          O sistema reúne entrada de demandas, BOT de triagem, voz em tempo real, avaliações, relatórios e configurações da operação para a empresa trabalhar com visão completa.
        </p>
        <div id="seguranca" className="mt-8 rounded-[2rem] border border-border/80 bg-card/55 p-6 backdrop-blur-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Segurança e controle</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Multi-tenant isolado, equipe auditável, histórico completo e visão central de chats, voz, reputação e desempenho.
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 72, rotateX: 18, rotateY: -12, scale: 0.94 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.28 }}
        transition={{ duration: 0.8, delay: 0.08 }}
        className="relative mx-auto w-full max-w-4xl [perspective:2200px]"
      >
        <div className="absolute inset-x-10 top-8 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative rounded-[2.5rem] border border-border/80 bg-slate-950/75 p-5 shadow-[0_40px_110px_-36px_rgba(37,99,235,0.55)] backdrop-blur-2xl">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4 rounded-[2rem] border border-border/70 bg-card/60 p-4">
              <div className="rounded-2xl bg-primary/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-primary">Operação</p>
                <p className="mt-2 text-3xl font-bold">24/7</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-sm font-semibold">Fila omnichannel</p>
                <p className="mt-2 text-sm text-muted-foreground">Chat, chamada, BOT e histórico unificados.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-sm font-semibold">Painel executivo</p>
                <p className="mt-2 text-sm text-muted-foreground">Gestão da empresa, equipe, relatórios e reputação.</p>
              </div>
            </div>
            <div className="rounded-[2rem] border border-border/70 bg-card/60 p-4">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                {['BOT resolve', 'Humano assume', 'Cliente avalia'].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/60 bg-slate-900/75 p-4 text-sm font-medium text-foreground">{item}</div>
                ))}
              </div>
              <div className="rounded-[1.8rem] border border-border/60 bg-gradient-to-br from-primary/10 via-card/50 to-sky-400/10 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">CSAT</p>
                    <p className="mt-2 text-3xl font-bold">4.9</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Tempo médio</p>
                    <p className="mt-2 text-3xl font-bold">01:42</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold">Evolução operacional</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">A liderança acompanha volume, qualidade, tempo de resposta e sinais de melhoria para orientar gerente e atendentes com clareza.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}