'use client'

import Link from 'next/link'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-background/80 via-primary/30 to-accent/40 border-b border-border shadow-xl shadow-primary/10 backdrop-blur-xl animate-fade-in">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <Logo size="sm" className="drop-shadow-glow group-hover:scale-105 transition-transform duration-200" />
          <span className="ml-2 text-xl font-extrabold text-primary tracking-tight hidden sm:inline-block animate-glow-text">AtendePro</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/auth/login">
            <button className="px-5 py-2 rounded-full font-semibold text-primary bg-white/70 hover:bg-primary/10 shadow-md shadow-primary/10 transition-all duration-200 border border-primary/10">Entrar</button>
          </Link>
          <Link href="/auth/register">
            <button className="px-6 py-2 rounded-full font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20 hover:opacity-90 animate-pulse border-2 border-primary/30 btn-press">Começar Grátis</button>
          </Link>
        </div>
      </div>
    </header>
  )
}