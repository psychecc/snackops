"use client";

import * as React from "react";
import { FlaskConical, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Tool } from "@/lib/types";

export function ToolsManager({ initialTools }: { initialTools: Tool[] }) {
  const [tools, setTools] = React.useState(initialTools);
  const [selectedId, setSelectedId] = React.useState(initialTools[0]?.id ?? "");
  const selected = tools.find((tool) => tool.id === selectedId) ?? null;
  const [testInput, setTestInput] = React.useState(
    JSON.stringify(initialTools[0]?.testInput ?? {}, null, 2),
  );
  const [result, setResult] = React.useState<unknown>(null);

  async function refreshTools() {
    const response = await fetch("/api/tools");
    const payload = (await response.json()) as { tools: Tool[] };
    setTools(payload.tools);
    const next = payload.tools.find((tool) => tool.id === selectedId) ?? payload.tools[0] ?? null;
    setSelectedId(next?.id ?? "");
    setTestInput(JSON.stringify(next?.testInput ?? {}, null, 2));
  }

  async function toggleTool() {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/tools/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !selected.enabled }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "保存失败");
      return;
    }

    toast.success(selected.enabled ? "已停用" : "已启用");
    await refreshTools();
  }

  async function runTest() {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/tools/${encodeURIComponent(selected.id)}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseJson(testInput)),
    });
    const payload = await response.json();
    setResult(payload);
    if (response.ok) {
      toast.success("测试完成");
    } else {
      toast.error("测试失败");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="ops-panel overflow-hidden">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-black">Tool 列表</h2>
          <p className="mt-1 text-xs text-muted-foreground">当前注册 {tools.length} 个 Tool</p>
        </div>
        <div className="max-h-[720px] overflow-auto p-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className="mb-2 grid w-full gap-2 rounded-md border border-border bg-card p-3 text-left hover:bg-muted"
              onClick={() => {
                setSelectedId(tool.id);
                setTestInput(JSON.stringify(tool.testInput ?? {}, null, 2));
                setResult(null);
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-black">{tool.name}</span>
                <Badge tone={tool.enabled ? "success" : "neutral"}>
                  {tool.enabled ? "启用" : "停用"}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
              <Badge>{tool.id}</Badge>
            </button>
          ))}
        </div>
      </section>

      <section className="ops-panel p-4">
        {selected ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black">{selected.name}</h1>
                <p className="mt-1 text-xs text-muted-foreground">{selected.implementation}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{selected.enabled ? "启用" : "停用"}</span>
                <Switch checked={selected.enabled} onCheckedChange={toggleTool} />
                <Button variant="outline" onClick={toggleTool}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  保存状态
                </Button>
              </div>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">{selected.description}</p>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-card p-3">
                <h2 className="mb-2 text-sm font-black">Input Schema</h2>
                <pre className="max-h-64 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                  {JSON.stringify(selected.inputSchema, null, 2)}
                </pre>
              </section>
              <section className="rounded-md border border-border bg-card p-3">
                <h2 className="mb-2 text-sm font-black">Output Schema</h2>
                <pre className="max-h-64 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                  {JSON.stringify(selected.outputSchema, null, 2)}
                </pre>
              </section>
            </div>

            <section className="rounded-md border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">单项测试</h2>
                <Button onClick={runTest}>
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  运行测试
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <textarea
                  className="min-h-64 rounded-md border border-border bg-white p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
                  value={testInput}
                  onChange={(event) => setTestInput(event.target.value)}
                />
                <pre className="max-h-64 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                  {JSON.stringify(result, null, 2)}
                </pre>
                {result && typeof result === "object" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={(result as { ok?: boolean }).ok ? "success" : "danger"}>
                      {(result as { ok?: boolean }).ok ? "成功" : "失败"}
                    </Badge>
                    <Badge>耗时：{String((result as { durationMs?: number }).durationMs ?? 0)}ms</Badge>
                    {(result as { error?: string }).error ? (
                      <Badge tone="danger">错误：{(result as { error?: string }).error}</Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted p-8 text-center text-sm font-semibold text-muted-foreground">
            空状态：请选择 Tool
          </div>
        )}
      </section>
    </div>
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { text: value };
  }
}
