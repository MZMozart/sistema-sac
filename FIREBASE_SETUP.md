# 🚨 ERRO: "Failed to get document because the client is offline"

Este erro significa que o **Firestore não consegue conectar ao banco de dados**.

## ✅ SOLUÇÃO RÁPIDA (5 minutos)

### 1. Criar Firestore Database
1. Acesse: https://console.firebase.google.com
2. Selecione projeto: `sistema-atendimento-global`
3. Menu esquerdo: **Build → Firestore Database**
4. **CLIQUE EM: Create database**
5. Selecione: **Start in test mode**
6. Região: `southamerica-east1` (São Paulo - Brasil)
7. **Done**

### 2. Aplicar Regras Abertas (Temporário)
1. No Firestore, clique em **Rules**
2. Substitua tudo por:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
3. **Publish**

### 3. Verificar Status
Após isso, recarregue a página. O indicador no header deve ficar **verde** (Conectado).

## 🔍 Como Saber se Deu Certo

Na página inicial (`http://localhost:3002`), você verá no header direito:

- 🟢 **Firebase: Conectado** = Tudo OK
- 🔴 **Firebase: Erro** = Ainda há problema

## 📋 Checklist Completo

- [ ] Firestore Database criado
- [ ] Regras aplicadas
- [ ] Indicador verde no header
- [ ] Cadastro funcionando
- [ ] Login funcionando

## ⚠️ Se Ainda Der Erro

Se mesmo após criar o Firestore ainda der erro, pode ser:

1. **Reinicie o projeto:**
```bash
# Pare o servidor (Ctrl+C)
npm run dev
```

2. **Limpe cache:**
```bash
Remove-Item -Recurse -Force .next
npm run dev
```

3. **Verifique console navegador:**
   - F12 → Console
   - Procure erros Firebase

## 🎯 Próximo Passo

Após conectar, teste:
1. Cadastro com email
2. Cadastro com Google
3. Login
4. Acesse dashboard

O sistema deve funcionar perfeitamente!