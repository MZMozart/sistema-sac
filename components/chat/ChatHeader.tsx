"use client";

import { Badge } from "@/components/ui/badge";

interface ChatHeaderProps {
  ticketId: string;
  status: "Open" | "Closed" | "Pending";
  agent?: string;
}

export function ChatHeader({ ticketId, status, agent }: ChatHeaderProps) {
  const badgeVariant = status === "Closed" ? "destructive" : status === "Open" ? "default" : "secondary";

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card rounded-t">
      <div>
        <div className="text-xs text-muted-foreground">Ticket #{ticketId}</div>
        <div className="text-lg font-semibold">Suporte ao Cliente</div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant}>{status}</Badge>
        <span className="text-xs text-muted-foreground">Agente: {agent || "Equipe de Suporte"}</span>
      </div>
    </div>
  );
}
