import { LegalLayout } from '@/components/layout/legal-layout'

export default function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso" description="Regras que orientam o uso da plataforma, responsabilidades das contas e limites operacionais do serviço.">
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">1. Objeto da plataforma</h2>
        <p>O AtendePro oferece uma plataforma de atendimento multiempresa para gestão de chats, chamadas, BOT, equipe, métricas, reputação e relatórios operacionais.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">2. Responsabilidade do usuário</h2>
        <p>O usuário deve fornecer informações corretas, manter credenciais seguras e utilizar a plataforma em conformidade com a legislação aplicável, inclusive normas de proteção de dados e atendimento ao consumidor.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">3. Conteúdo e operação da empresa</h2>
        <p>Cada empresa é responsável pelas políticas cadastradas no BOT, horários, permissões da equipe, gravações, comunicações com clientes e integridade das informações compartilhadas na operação.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">4. Segurança e acesso</h2>
        <p>O acesso pode ser bloqueado em caso de uso indevido, violação de segurança, fraude, tentativa de acesso não autorizado a dados de terceiros ou mau uso das integrações disponíveis.</p>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">5. Evolução do produto</h2>
        <p>Recursos podem ser aprimorados ao longo do tempo para elevar segurança, estabilidade, rastreabilidade e conformidade operacional da plataforma.</p>
      </section>
    </LegalLayout>
  )
}