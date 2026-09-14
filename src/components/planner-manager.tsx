"use client";

import * as React from "react";
import { Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Skill, Tool } from "@/lib/types";
import type { PlannerConfig } from "@/lib/planner-config";

export function PlannerManager({
  initialConfig,
  initialSkills,
  initialTools,
}: {
  initialConfig: PlannerConfig;
  initialSkills: Skill[];
  initialTools: Tool[];
}) {
  const [config, setConfig] = React.useState(initialConfig);
  const [selectedSkillIds, setSelectedSkillIds] = React.useState(initialSkills.map((skill) => skill.id));
  const [selectedToolIds, setSelectedToolIds] = React.useState(initialTools.map((tool) => tool.id));
  const [question, setQuestion] = React.useState("每日坚果买两份现在最终价多少？");
  const [preview, setPreview] = React.useState<unknown>(null);
  const [error, setError] = React.useState("");

  async function saveConfig() {
    const response = await fetch("/api/planner", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "保存失败");
      toast.error(payload.error ?? "保存失败");
      return;
    }
    setConfig(payload.config);
    setError("");
    toast.success("Planner 配置已保存");
  }

  async function runPreview() {
    const response = await fetch("/api/planner/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userInput: question,
        selectedSkillIds,
        selectedToolIds,
        mandatoryCapabilities: config.mandatoryCapabilities,
      }),
    });
    const payload = await response.json();
    setPreview(payload);
    if (payload.ok) toast.success("计划合法");
    else toast.error("计划非法");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="ops-panel grid gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge tone="info">Planner</Badge>
            <h1 className="mt-3 text-xl font-black">Planner 配置</h1>
          </div>
          <Button onClick={saveConfig}>
            <Save className="h-4 w-4" aria-hidden="true" />
            保存
          </Button>
        </div>
        {error ? (
          <div className="rounded-md border border-[#e5a19b] bg-[#fff1ef] p-3 text-sm font-semibold text-danger">
            错误状态：{error}
          </div>
        ) : null}
        <Field label="版本" value={config.version} onChange={(value) => setConfig({ ...config, version: value })} />
        <label className="grid gap-1">
          <span className="ops-label">Planner Prompt</span>
          <textarea
            className="min-h-36 rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={config.prompt}
            onChange={(event) => setConfig({ ...config, prompt: event.target.value })}
          />
        </label>
        <label className="grid gap-1">
          <span className="ops-label">mandatoryCapabilities，逗号分隔</span>
          <input
            className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={config.mandatoryCapabilities.join(", ")}
            onChange={(event) =>
              setConfig({
                ...config,
                mandatoryCapabilities: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </section>

      <section className="ops-panel grid gap-4 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <CapabilityPicker
            title="启用 Skill"
            items={initialSkills}
            selectedIds={selectedSkillIds}
            onChange={setSelectedSkillIds}
          />
          <CapabilityPicker
            title="启用 Tool"
            items={initialTools}
            selectedIds={selectedToolIds}
            onChange={setSelectedToolIds}
          />
        </div>
        <div className="grid gap-2">
          <span className="ops-label">测试问题</span>
          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button onClick={runPreview}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              预览
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <pre className="max-h-[520px] overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
              {JSON.stringify((preview as { plan?: unknown }).plan, null, 2)}
            </pre>
            <pre className="max-h-[520px] overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
              {JSON.stringify((preview as { validation?: unknown }).validation ?? (preview as { error?: unknown }).error, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted p-6 text-center text-sm font-semibold text-muted-foreground">
            空状态：等待 Planner 预览
          </div>
        )}
      </section>
    </div>
  );
}

function CapabilityPicker({
  title,
  items,
  selectedIds,
  onChange,
}: {
  title: string;
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h2 className="mb-2 text-sm font-black">{title}</h2>
      <div className="grid max-h-60 gap-2 overflow-auto">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm font-semibold text-muted-foreground">
            空状态：无可用能力
          </div>
        ) : null}
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          return (
            <label key={item.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(checked ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])
                }
              />
              <span className="font-semibold">{item.name}</span>
              <Badge>{item.id}</Badge>
            </label>
          );
        })}
      </div>
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
