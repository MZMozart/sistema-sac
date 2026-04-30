import { LegalLayout } from '@/components/layout/legal-layout'

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" description="Como os dados são coletados, utilizados, protegidos e mantidos dentro da estrutura multiempresa da plataforma.">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">1. Dados coletados</h2>
        <p>Coletamos dados de autenticação, cadastro, empresa, equipe, chats, chamadas, relatórios, reputação pública e auditoria operacional, sempre dentro da finalidade do serviço.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">2. Isolamento por empresa</h2>
        <p>As informações de cada empresa são tratadas por tenant, com separação lógica de chats, chamadas, BOT, equipe, relatórios e avaliações.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">3. Finalidade do uso</h2>
        <p>Os dados são utilizados para autenticação, execução do atendimento, roteamento de filas, histórico, métricas, reputação e melhoria da experiência da operação.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">4. Documentos e verificações</h2>
        <p>Documentos enviados durante o cadastro são usados para autenticação básica, rastreabilidade e prevenção a uso indevido da plataforma.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">5. Direitos do titular</h2>
        <p>O usuário pode solicitar atualização, revisão ou exclusão dos próprios dados conforme os recursos de perfil, configurações e remoção de conta disponíveis no sistema.</p>
      </section>
    </LegalLayout>
  )
}