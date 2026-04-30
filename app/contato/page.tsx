import { Mail, MessageSquare, Phone } from 'lucide-react'
import { LegalLayout } from '@/components/layout/legal-layout'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export default function ContactPage() {
  return (
    <LegalLayout title="Contato" description="Canal institucional para assuntos comerciais, suporte operacional, jurídico e alinhamentos de implantação.">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Mail, title: 'Email', value: 'contato@atendepro.app' },
          { icon: Phone, title: 'Telefone', value: '+55 11 4000-0000' },
          { icon: MessageSquare, title: 'Atendimento', value: 'Disponível dentro do portal do cliente' },
        ].map((item) => (
          <div key={item.title} className="rounded-3xl border border-border bg-card/60 p-5">
            <item.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Formulário institucional</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Seu nome" data-testid="contact-name-input" />
          <Input placeholder="Seu email" type="email" data-testid="contact-email-input" />
          <Input placeholder="Empresa" data-testid="contact-company-input" />
          <Input placeholder="Assunto" data-testid="contact-subject-input" />
          <div className="md:col-span-2">
            <Textarea placeholder="Descreva sua necessidade" className="min-h-[180px]" data-testid="contact-message-input" />
          </div>
          <Button className="bg-gradient-primary text-primary-foreground md:col-span-2" data-testid="contact-submit-button">Enviar mensagem</Button>
        </div>
      </section>
    </LegalLayout>
  )
}