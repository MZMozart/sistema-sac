'use client'

import { motion } from 'framer-motion'
import { BarChart3, Bot, Building2, Phone, Shield, Users } from 'lucide-react'

const items = [
  { icon: Building2, title: 'Multiempresa isolado', text: 'Cada empresa opera com BOT, horários, chats, chamadas e políticas próprias.' },
  { icon: Users, title: 'Equipe e permissões', text: 'Donos, gerentes e funcionários com controle hierárquico e acesso granular.' },
  { icon: Bot, title: 'Atendimento assistido', text: 'BOT orienta, transfere e registra contexto do cliente antes do humano assumir.' },
  { icon: Phone, title: 'Voz no próprio sistema', text: 'Cliente liga de dentro do produto e o atendente responde pela central em tempo real.' },
  { icon: BarChart3, title: 'Analytics operacionais', text: 'Relatórios, métricas, exportações e histórico para gestão completa.' },
  { icon: Shield, title: 'Auditoria e rastreio', text: 'Logs por empresa, histórico de equipe, reputação e visão consolidada da operação.' },
]

export function FeatureGrid() {
  return (
    <section id="recursos" className="space-y-8">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-bold sm:text-5xl">Tudo que a operação precisa, sem separar em vários sistemas.</h2>
        <p className="mt-4 text-base leading-8 text-muted-foreground">Uma experiência visual forte por fora e uma base operacional consistente por dentro.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <motion.div key={item.title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.06 }} whileHover={{ y: -6, boxShadow: '0 24px 60px -26px rgba(59,130,246,0.35)' }} className="rounded-[2rem] border border-border/80 bg-card/55 p-6 backdrop-blur-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
              <item.icon className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}