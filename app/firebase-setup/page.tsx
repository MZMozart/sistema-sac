'use client'

import { useState, useEffect } from 'react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle, ExternalLink, AlertTriangle, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { auth, db } from '@/lib/firebase'

export default function FirebaseSetupPage() {
  const [firebaseConnected, setFirebaseConnected] = useState<boolean | null>(null)
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null)
  const [firestoreEnabled, setFirestoreEnabled] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Test Firebase connection
    const testConnection = async () => {
      try {
        // Check if Firebase app is initialized
        if (auth.app) {
          setFirebaseConnected(true)
        }
      } catch {
        setFirebaseConnected(false)
      }
    }
    testConnection()
  }, [])

  const copyRules = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }
    match /employees/{employeeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
    }
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}`
    navigator.clipboard.writeText(rules)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = [
    {
      title: '1. Acessar o Console do Firebase',
      description: 'Acesse o Console do Firebase e selecione seu projeto.',
      action: (
        <a
          href="https://console.firebase.google.com/project/sistema-atendimento-global/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Abrir Console
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </a>
      ),
    },
    {
      title: '2. Ativar Autenticacao por Email/Senha',
      description: 'No menu lateral, va em Authentication > Sign-in method > Email/Senha e ative.',
      action: (
        <a
          href="https://console.firebase.google.com/project/sistema-atendimento-global/authentication/providers"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Configurar Auth
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </a>
      ),
    },
    {
      title: '3. Ativar Login com Google',
      description: 'Na mesma pagina, ative o provedor Google e configure o email de suporte.',
      action: (
        <a
          href="https://console.firebase.google.com/project/sistema-atendimento-global/authentication/providers"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Configurar Google
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </a>
      ),
    },
    {
      title: '4. Criar Banco de Dados Firestore',
      description: 'Va em Firestore Database e crie um banco de dados no modo de producao.',
      action: (
        <a
          href="https://console.firebase.google.com/project/sistema-atendimento-global/firestore"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Criar Firestore
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </a>
      ),
    },
    {
      title: '5. Configurar Regras de Seguranca',
      description: 'Copie as regras abaixo e cole na aba "Regras" do Firestore.',
      action: (
        <Button variant="outline" size="sm" onClick={copyRules}>
          {copied ? (
            <>
              <Check className="mr-2 w-4 h-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 w-4 h-4" />
              Copiar Regras
            </>
          )}
        </Button>
      ),
    },
    {
      title: '6. Adicionar Dominio Autorizado',
      description: 'Em Authentication > Settings > Dominios autorizados, adicione o dominio da sua aplicacao.',
      action: (
        <a
          href="https://console.firebase.google.com/project/sistema-atendimento-global/authentication/settings"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            Configurar Dominios
            <ExternalLink className="ml-2 w-4 h-4" />
          </Button>
        </a>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Configuracao do Firebase</h1>
          <p className="text-muted-foreground">
            Siga os passos abaixo para configurar o Firebase corretamente e ativar a autenticacao.
          </p>
        </div>

        {/* Status Card */}
        <Card className="mb-8 border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  Erro: auth/configuration-not-found
                </h3>
                <p className="text-sm text-muted-foreground">
                  Este erro significa que os provedores de autenticacao nao estao ativados no seu projeto Firebase.
                  Siga os passos abaixo para resolver.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card key={index} className="border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                    {step.action}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Rules Preview */}
        <Card className="mt-8 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Regras do Firestore</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-xs">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }
    match /employees/{employeeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /chats/{chatId} {
      allow read, write: if request.auth != null;
    }
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}`}
            </pre>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="text-muted-foreground mb-4">
            Apos completar todos os passos, volte e tente novamente.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth/register">
              <Button className="bg-gradient-primary">
                Tentar Cadastrar Novamente
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline">
                Ir para Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
