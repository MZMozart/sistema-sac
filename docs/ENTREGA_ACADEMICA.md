# Entrega academica - AtendePro

Este arquivo existe para facilitar a apresentacao em sala sem alterar a logica principal do sistema.

## Interfaces existentes

O projeto ja possui mais de 12 interfaces navegaveis:

1. Landing page publica (`/`)
2. Login (`/auth/login`)
3. Cadastro (`/auth/register`)
4. Recuperacao de senha (`/auth/forgot-password`)
5. Configuracao Firebase (`/firebase-setup`)
6. Dashboard da empresa (`/dashboard`)
7. Chats da empresa (`/dashboard/chats`)
8. Telefonia e ligacoes (`/dashboard/telephony`)
9. Configuracao do BOT (`/dashboard/bot`)
10. Equipe e colaboradores (`/dashboard/employees`)
11. Perfil da empresa (`/dashboard/profile`)
12. Configuracoes da empresa (`/dashboard/settings`)
13. Auditoria por protocolo (`/dashboard/auditoria/[protocol]`)
14. Dashboard do cliente (`/cliente/dashboard`)
15. Novo atendimento do cliente (`/cliente/novo`)
16. Chat do cliente (`/cliente/chat/[id]`)
17. Ligacao do cliente (`/cliente/call/[id]`)
18. Pagina publica da empresa (`/empresa/[id]`)

## Testes adicionados

- Unitarios: fila de ligacoes, auditoria, autenticacao e criacao de protocolo.
- Integracao: fluxo de chat, fluxo de ligacao e login com acesso a rota protegida.
- Mocks: Firebase Auth e Firestore em memoria, sem depender do projeto real do Firebase.

Comandos:

```bash
npm run test
npm run test:watch
```

## Pontos para demonstrar

- Fila de ligacoes: `lib/call-queue.ts`
- Auditoria: `lib/audit.ts`
- WebRTC e voz da URA: `app/cliente/call/[id]/page.tsx`
- Configuracao de 2FA: rotas em `app/api/twofactor`
- App instalavel no celular: `app/manifest.ts` e `components/pwa-register.tsx`

