# Routing Map (SaaS Atendimento)

## Redirect Logic

- **client**
  - `/cliente/dashboard`
- **company owner**
  - `/empresa/dashboard`
- **company manager**
  - `/empresa/gestao`
- **company agent**
  - `/empresa/atendimento`

## Route Protection

| Route                      | Allowed AccountType | Allowed Role(s)      |
|---------------------------|---------------------|----------------------|
| /cliente/dashboard         | client              | -                    |
| /empresa/dashboard        | company             | owner, manager       |
| /empresa/gestao           | company             | manager, owner       |
| /empresa/atendimento      | company             | agent, owner         |
| /empresa/configuracoes    | company             | owner                |
| /empresa/integracoes      | company             | owner                |
| /empresa/equipe           | company             | owner, manager       |
| /empresa/chats            | company             | manager, owner       |
| /empresa/clientes         | company             | manager, owner       |

## Example Usage (AuthGuard)

```tsx
<AuthGuard allowed={[{ accountType: 'company', role: 'manager' }]}>
  <GestaoPage />
</AuthGuard>
```

## Notes
- Client cannot access /empresa/*
- Agent cannot access /empresa/configuracoes, /empresa/integracoes, /empresa/equipe
- Manager can access /empresa/dashboard, /empresa/gestao, /empresa/chats, /empresa/clientes
- Owner can access all company routes
