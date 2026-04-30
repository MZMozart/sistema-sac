"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { AuthGuard } from "@/components/AuthGuard";

type AppLayoutUserType = "client" | "company";

interface AppLayoutProps {
  children: ReactNode;
  userType: AppLayoutUserType;
}

export default function AppLayout({ children, userType }: AppLayoutProps) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setExpanded(false);

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  return (
    <AuthGuard allowed={[{ accountType: userType }]}> {/* Route protection */}
      <div className="min-h-screen bg-muted">
        <Header scope={userType === 'company' ? 'company' : 'client'} profileHref={userType === 'company' ? '/dashboard/profile' : '/cliente/perfil'} settingsHref={userType === 'company' ? '/dashboard/settings' : '/cliente/configuracoes'} />
        <Sidebar userType={userType} expanded={expanded} onOpen={() => setExpanded(true)} onClose={closeSidebar} />
        <main className="min-h-screen pl-24 pr-4 pt-20">{children}</main>
      </div>
    </AuthGuard>
  );
}
