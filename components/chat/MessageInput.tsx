"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MessageInput({ onSend }: { onSend: (value: string) => void }) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    if (value.trim()) {
      onSend(value);
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 border-t border-border bg-card rounded-b">
      <textarea
        className="flex-1 resize-none rounded px-3 py-2 border bg-background text-sm"
        rows={1}
        placeholder="Digite sua mensagem..."
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button onClick={handleSend} size="sm">Enviar</Button>
      {/* Futuro: ícone de anexo */}
    </div>
  );
}
