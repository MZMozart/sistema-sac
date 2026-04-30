'use client'

import { AlertOctagon } from 'lucide-react'

export default function GlobalError() {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertOctagon className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-bold">Proteção global ativada</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              O sistema interceptou um erro crítico e evitou uma tela branca sem saída. Reabra a área desejada pelo menu para continuar.
            </p>
            <a href="/dashboard" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
              Ir para o dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}