"use client";

interface MessageBubbleProps {
  text: string;
  timestamp: string;
  sender?: string;
  isClient: boolean;
}

export function MessageBubble({ text, timestamp, sender, isClient }: MessageBubbleProps) {
  return (
    <div className={`flex ${isClient ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-xs rounded-lg px-4 py-2 shadow-sm ${isClient ? "bg-primary text-white" : "bg-muted text-foreground"}`}>
        {!isClient && sender ? <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{sender}</div> : null}
        <div className="text-sm whitespace-pre-line">{text}</div>
        <div className="text-xs text-muted-foreground mt-1 text-right">{timestamp}</div>
      </div>
    </div>
  );
}
