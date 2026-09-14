"use client";

import * as React from "react";
import { Handshake, MessageSquarePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RunDetailActions({ runId }: { runId: string }) {
  const [note, setNote] = React.useState("人工复核");

  async function retry() {
    const response = await fetch("/api/run/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    toast[response.ok ? "success" : "error"](response.ok ? "已重试" : "重试失败");
  }

  async function handoff() {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "详情页人工接管" }),
    });
    toast[response.ok ? "success" : "error"](response.ok ? "已接管" : "接管失败");
  }

  async function annotate() {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/annotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "人工标注", note }),
    });
    toast[response.ok ? "success" : "error"](response.ok ? "标注已保存" : "标注失败");
  }

  return (
    <div className="ops-panel grid gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={retry}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          重试
        </Button>
        <Button variant="outline" onClick={handoff}>
          <Handshake className="h-4 w-4" aria-hidden="true" />
          接管
        </Button>
        <Button onClick={annotate}>
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          标注
        </Button>
      </div>
      <input
        className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </div>
  );
}
