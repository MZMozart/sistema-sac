"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";

export function ClientHeader() {
  const { userData, signOut } = useAuth();
  const userName = userData?.name || userData?.fullName || "Cliente";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-16 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/cliente/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Logo size="sm" />
          <span>Mozart Support</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="relative">
            <button
              className="flex items-center gap-2 focus:outline-none"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Avatar className="w-8 h-8" />
              <span className="font-medium">{userName}</span>
              <span className="ml-1">▼</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg border z-10">
                <Link href="/cliente/perfil" className="block px-4 py-2 hover:bg-muted">Perfil</Link>
                <Link href="/cliente/configuracoes" className="block px-4 py-2 hover:bg-muted">Configurações</Link>
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-muted"
                  onClick={signOut}
                >Sair</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
