"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  PlusCircle,
  Settings,
} from "lucide-react";

export function ClientSidebar() {
  const pathname = usePathname();

  const items = [
    { label: "Dashboard", href: "/cliente/dashboard", icon: Home },
    { label: "Meus Atendimentos", href: "/cliente/atendimentos", icon: MessageSquare },
    { label: "Abrir Atendimento", href: "/cliente/novo", icon: PlusCircle },
    { label: "Configurações", href: "/cliente/configuracoes", icon: Settings },
  ];

  return (
    <aside className="w-64 lg:w-64 md:w-20 bg-card border-r border-border h-full fixed top-0 left-0 pt-16 overflow-auto z-30">
      <nav className="flex flex-col">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-3 hover:bg-secondary transition-colors ${
                active ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:inline truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
