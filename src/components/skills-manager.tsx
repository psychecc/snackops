"use client";

import * as React from "react";
import { Eye, FileDiff, FlaskConical, Save, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Skill, SkillVersion } from "@/lib/types";

type SkillsManagerProps = {
  initialSkills: Skill[];
  initialVersions: Record<string, SkillVersion[]>;
};

export function SkillsManager({ initialSkills, initialVersions }: SkillsManagerProps) {
  const [skills, setSkills] = React.useState(initialSkills);
  const [versions, setVersions] = React.useState(initialVersions);
  const [selectedId, setSelectedId] = React.useState(initialSkills[0]?.id ?? "");
  const [draft, setDraft] = React.useState<Skill | null>(initialSkills[0] ?? null);
  const [changeNote, setChangeNote] = React.useState("运营调整");
  const [testInput, setTestInput] = React.useState('{"message":"想买酸甜办公室零食，有优惠吗？"}');
  const [testResult, setTestResult] = React.useState<unknown>(null);
  const [diffText, setDiffText] = React.useState("");
  const [versionText, setVersionText] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "enabled" | "disabled">("all");
  const [lastError, setLastError] = React.useState("");

  const selected = skills.find((skill) => skill.id === selectedId) ?? null;
  const filteredSkills = skills.filter((skill) => {
    if (filter === "enabled") return skill.enabled;
    if (filter === "disabled") return !skill.enabled;
    return true;
  });

  async function refreshSkills() {
    const response = await fetch("/api/skills");
    const payload = (await response.json()) as { skills: Skill[] };
    setSkills(payload.skills);
    const next = payload.skills.find((skill) => skill.id === selectedId) ?? payload.skills[0] ?? null;
    setSelectedId(next?.id ?? "");
    setDraft(next ? { ...next } : null);
  }

  async function refreshVersions(skillId: string) {
    const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}/versions`);
    const payload = (await response.json()) as { versions: SkillVersion[] };
    setVersions((current) => ({ ...current, [skillId]: payload.versions }));
  }

  async function saveDraft() {
    if (!draft) {
      return;
    }

    const response = await fetch(`/api/skills/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, changeNote }),
    });
    const payload = await response.json();

    if (!response.ok) {
      const message = payload.error ?? "保存失败";
      setLastError(message);
      toast.error(message);
      return;
    }

    setLastError("");
    toast.success("保存成功，修改前快照已保留");
    await Promise.all([refreshSkills(), refreshVersions(draft.id)]);
  }

  async function toggleSelected() {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/skills/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !selected.enabled,
        changeNote: selected.enabled ? "停用 Skill" : "启用 Skill",
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      const message = payload.error ?? "状态更新失败";
      setLastError(message);
      toast.error(message);
      return;
    }

    setLastError("");
    toast.success(selected.enabled ? "已停用" : "已启用");
    await Promise.all([refreshSkills(), refreshVersions(selected.id)]);
  }

  async function saveVersion() {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/skills/${encodeURIComponent(selected.id)}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeNote }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "版本保存失败");
      return;
    }

    toast.success("版本已保存");
    await refreshVersions(selected.id);
  }

  async function runTest() {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/skills/${encodeURIComponent(selected.id)}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parseJson(testInput)),
    });
    const payload = await response.json();
    setTestResult(payload);
    if (response.ok) {
      toast.success("测试完成");
    } else {
      toast.error("测试失败");
    }
  }

  async function viewDiff(versionId: string) {
    if (!selected) {
      return;
    }

    const response = await fetch(
      `/api/skills/${encodeURIComponent(selected.id)}/versions/${encodeURIComponent(versionId)}/diff`,
    );
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Diff 获取失败");
      return;
    }

    setDiffText(payload.diff);
  }

  async function viewVersion(versionId: string) {
    if (!selected) {
      return;
    }

    const response = await fetch(
      `/api/skills/${encodeURIComponent(selected.id)}/versions/${encodeURIComponent(versionId)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      const message = payload.error ?? "版本正文获取失败";
      setLastError(message);
      toast.error(message);
      return;
    }

    setVersionText(payload.version.systemPrompt);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="ops-panel overflow-hidden">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-black">Skill 列表</h2>
          <p className="mt-1 text-xs text-muted-foreground">当前注册 {skills.length} 个 Skill</p>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-md border border-border bg-muted p-1">
            {(["all", "enabled", "disabled"] as const).map((item) => (
              <button
                key={item}
                className={`h-8 rounded-md text-xs font-bold ${filter === item ? "bg-card text-foreground" : "text-muted-foreground"}`}
                onClick={() => setFilter(item)}
                type="button"
              >
                {item === "all" ? "全部" : item === "enabled" ? "启用" : "停用"}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[720px] overflow-auto p-2">
          {filteredSkills.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm font-semibold text-muted-foreground">
              空状态：没有匹配的 Skill
            </div>
          ) : null}
          {filteredSkills.map((skill) => (
            <button
              key={skill.id}
              className="mb-2 grid w-full gap-2 rounded-md border border-border bg-card p-3 text-left hover:bg-muted"
              onClick={() => {
                setSelectedId(skill.id);
                setDraft({ ...skill });
                setDiffText("");
                setVersionText("");
                setTestResult(null);
                setLastError("");
              }}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-black">{skill.name}</span>
                <Badge tone={skill.enabled ? "success" : "neutral"}>
                  {skill.enabled ? "启用" : "停用"}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
              <div className="flex flex-wrap gap-1">
                <Badge>{skill.id}</Badge>
                <Badge>v{skill.version}</Badge>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="ops-panel p-4">
        {draft ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black">{draft.name}</h1>
                <p className="mt-1 text-xs text-muted-foreground">{draft.filePath}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={toggleSelected}>
                  <ToggleLeft className="h-4 w-4" aria-hidden="true" />
                  {selected?.enabled ? "停用" : "启用"}
                </Button>
                <Button variant="secondary" onClick={saveVersion}>
                  <FileDiff className="h-4 w-4" aria-hidden="true" />
                  保存版本
                </Button>
                <Button onClick={saveDraft}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  保存
                </Button>
              </div>
            </div>

            {lastError ? (
              <div className="rounded-md border border-[#e5a19b] bg-[#fff1ef] p-3 text-sm font-semibold text-danger">
                错误状态：{lastError}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="名称" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
              <Field label="模型" value={draft.model} onChange={(value) => setDraft({ ...draft, model: value })} />
              <Field
                label="版本"
                value={draft.version}
                onChange={(value) => setDraft({ ...draft, version: value })}
              />
              <Field
                label="文件路径"
                value={draft.filePath}
                onChange={(value) => setDraft({ ...draft, filePath: value })}
              />
              <Field
                label="temperature"
                value={String(draft.temperature)}
                onChange={(value) => setDraft({ ...draft, temperature: Number(value) })}
              />
              <Field
                label="maxTokens"
                value={String(draft.maxTokens)}
                onChange={(value) => setDraft({ ...draft, maxTokens: Number(value) })}
              />
            </div>

            <label className="grid gap-1">
              <span className="ops-label">描述</span>
              <textarea
                className="min-h-20 rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>

            <label className="grid gap-1">
              <span className="ops-label">requiredTools，逗号分隔</span>
              <input
                className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={draft.requiredTools.join(", ")}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    requiredTools: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            <label className="grid gap-1">
              <span className="ops-label">system prompt</span>
              <textarea
                className="min-h-72 rounded-md border border-border bg-white p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary"
                value={draft.systemPrompt ?? ""}
                onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
              />
            </label>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black">版本</h2>
                  <Field
                    compact
                    label="变更说明"
                    value={changeNote}
                    onChange={(value) => setChangeNote(value)}
                  />
                </div>
                <div className="grid max-h-72 gap-2 overflow-auto">
                  {(versions[draft.id] ?? []).length === 0 ? (
                    <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm font-semibold text-muted-foreground">
                      空状态：暂无版本快照
                    </div>
                  ) : (
                    versions[draft.id].map((version) => (
                      <div key={version.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-black">v{version.version}</span>
                          <Button size="sm" variant="outline" onClick={() => viewDiff(version.id)}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            查看 diff
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => viewVersion(version.id)}>
                            正文
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{version.changeNote}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{version.createdAt}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-md border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black">测试</h2>
                  <Button size="sm" onClick={runTest}>
                    <FlaskConical className="h-4 w-4" aria-hidden="true" />
                    测试
                  </Button>
                </div>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-white p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-primary"
                  value={testInput}
                  onChange={(event) => setTestInput(event.target.value)}
                />
                <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </section>
            </div>

            <section className="rounded-md border border-border bg-card p-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-sm font-black">版本正文</h2>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[#211f1c] p-3 text-xs text-white">
                    {versionText || "空状态：选择一个版本查看正文"}
                  </pre>
                </div>
                <div>
                  <h2 className="mb-3 text-sm font-black">Diff</h2>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[#211f1c] p-3 text-xs text-white">
                    {diffText || "空状态：选择一个版本查看 diff"}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted p-8 text-center text-sm font-semibold text-muted-foreground">
            空状态：请选择 Skill
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={compact ? "grid min-w-48 gap-1" : "grid gap-1"}>
      <span className="ops-label">{label}</span>
      <input
        className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { text: value };
  }
}
