"use client";

import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 left-0 right-0 z-50 bg-background border-b border-border h-16 shadow-sm flex items-center">
        <Link href="/" className="ml-4 flex items-center gap-2 font-bold text-lg text-primary">
          <Logo size="sm" />
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link href="/auth/login" className="text-primary font-medium hover:underline">Entrar</Link>
          <Link href="/auth/register" className="text-primary font-medium hover:underline">Cadastrar</Link>
        </nav>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
