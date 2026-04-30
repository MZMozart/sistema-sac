"use client";

import { MessageBubble } from "./MessageBubble";

export function MessageList({ messages, clientId }: { messages: any[]; clientId: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 overflow-y-auto h-full">
      {messages.map((msg, idx) => (
        <MessageBubble
          key={idx}
          text={msg.text}
          timestamp={msg.timestamp}
          sender={msg.sender}
          isClient={msg.sender === clientId}
        />
      ))}
    </div>
  );
}
