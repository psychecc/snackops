"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function DemoChat() {
  const [input, setInput] = React.useState("推荐一个酸甜零食，顺便算一下优惠");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [runId, setRunId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function send() {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: text }]);
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput: text, source: "demo" }),
    });
    const payload = await response.json();
    setMessages((current) => [
      ...current,
      { role: "assistant", content: payload.run?.finalReply || payload.run?.error || "运行失败" },
    ]);
    setRunId(payload.run?.id ?? "");
    setLoading(false);
  }

  return (
    <div className="ops-panel mx-auto grid max-w-3xl gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Demo Chat</h1>
        {runId ? <Badge>{runId}</Badge> : <Badge tone="neutral">未运行</Badge>}
      </div>
      <div className="grid min-h-96 gap-3 rounded-md border border-border bg-muted p-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center text-sm font-semibold text-muted-foreground">
            空状态：开始一轮演示对话
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={message.role === "user" ? "justify-self-end rounded-md bg-primary p-3 text-sm text-white" : "justify-self-start rounded-md bg-card p-3 text-sm"}
            >
              {message.content}
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button onClick={send} disabled={loading}>
          <Send className="h-4 w-4" aria-hidden="true" />
          发送
        </Button>
      </div>
    </div>
  );
}
