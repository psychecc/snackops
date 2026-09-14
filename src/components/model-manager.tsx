"use client";

import * as React from "react";
import { Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PublicConfig = {
  stored: {
    provider: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    notes?: string;
  };
  resolved: {
    provider: string;
    model: string;
    baseUrl: string;
  };
  lockedByEnv: boolean;
  providers: Array<{ id: string; name: string; description: string }>;
  models: string[];
  envStatus: Record<string, boolean>;
  configurationStatus: {
    provider: string;
    ready: boolean;
    mode: string;
    required: string[];
    missing: string[];
    message: string;
  };
};

export function ModelManager({ initialConfig }: { initialConfig: PublicConfig }) {
  const [config, setConfig] = React.useState(initialConfig);
  const [draft, setDraft] = React.useState(initialConfig.stored);
  const [testResult, setTestResult] = React.useState<unknown>(null);

  async function refresh() {
    const response = await fetch("/api/llm-config");
    const payload = await response.json();
    setConfig(payload.config);
    setDraft(payload.config.stored);
  }

  async function save() {
    const response = await fetch("/api/llm-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "保存失败");
      return;
    }
    toast.success("模型配置已保存");
    setConfig(payload.config);
  }

  async function switchProvider(provider: string) {
    const response = await fetch("/api/llm-config/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model: draft.model, baseUrl: draft.baseUrl }),
    });
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "切换失败");
      return;
    }
    toast.success("Provider 已切换");
    setConfig(payload.config);
    setDraft(payload.config.stored);
  }

  async function test() {
    const response = await fetch("/api/llm-config/test", { method: "POST" });
    const payload = await response.json();
    setTestResult(payload);
    if (response.ok) toast.success("连接测试完成");
    else toast.error("连接测试失败");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="ops-panel grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone={config.resolved.provider === "classroom-fixture" ? "warning" : "success"}>
              当前模式：{config.resolved.provider}
            </Badge>
            <h1 className="mt-3 text-xl font-black">模型管理</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>刷新</Button>
            <Button onClick={save}>
              <Save className="h-4 w-4" aria-hidden="true" />
              保存
            </Button>
          </div>
        </div>
        {config.resolved.provider === "classroom-fixture" ? (
          <div className="rounded-md border border-[#efc071] bg-[#fff4df] p-3 text-sm font-semibold text-[#805114]">
            classroom-fixture：演示稳定模式，无外部密钥，输出确定但仍走完整 Agent 链路。
          </div>
        ) : null}
        <div
          className={`rounded-md border p-3 text-sm font-semibold ${
            config.configurationStatus.ready
              ? "border-[#8ec8a8] bg-[#edf8f2] text-success"
              : "border-[#e5a19b] bg-[#fff1ef] text-danger"
          }`}
        >
          <div>{config.configurationStatus.mode}：{config.configurationStatus.ready ? "配置可用" : "配置缺失"}</div>
          <p className="mt-1 leading-6">{config.configurationStatus.message}</p>
          {config.configurationStatus.missing.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {config.configurationStatus.missing.map((item) => <Badge key={item} tone="danger">{item} 缺失</Badge>)}
            </div>
          ) : null}
        </div>
        <Field label="Provider" value={draft.provider} onChange={(value) => setDraft({ ...draft, provider: value })} />
        <Field label="默认模型" value={draft.model} onChange={(value) => setDraft({ ...draft, model: value })} />
        <Field label="Base URL" value={draft.baseUrl} onChange={(value) => setDraft({ ...draft, baseUrl: value })} />
        <Field
          label="timeoutMs"
          value={String(draft.timeoutMs)}
          onChange={(value) => setDraft({ ...draft, timeoutMs: Number(value) })}
        />
        <div className="flex flex-wrap gap-2">
          {config.providers.map((provider) => (
            <Button key={provider.id} variant="outline" onClick={() => switchProvider(provider.id)}>
              切换 {provider.id}
            </Button>
          ))}
        </div>
      </section>

      <section className="ops-panel grid gap-4 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="mb-3 text-sm font-black">Provider 描述</h2>
            <div className="grid gap-2">
              {config.providers.map((provider) => (
                <div key={provider.id} className="rounded-md border border-border p-3">
                  <div className="font-black">{provider.name}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{provider.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="mb-3 text-sm font-black">环境变量状态</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(config.envStatus).map(([key, present]) => (
                <Badge key={key} tone={present ? "success" : "neutral"}>
                  {key}: {present ? "已配置" : "未配置"}
                </Badge>
              ))}
            </div>
            <h2 className="mb-3 mt-5 text-sm font-black">模型列表</h2>
            <div className="flex flex-wrap gap-2">
              {config.models.map((model) => (
                <Badge key={model}>{model}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black">连接测试</h2>
            <Button onClick={test}>
              <TestTube2 className="h-4 w-4" aria-hidden="true" />
              测试连接
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <input
        className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
