"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { ClipboardList, FlaskConical, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { EvalCase, Run, Skill, Tool } from "@/lib/types";

type OpsTabsProps = {
  skills: Skill[];
  tools: Tool[];
  runs: Run[];
  evalCases: EvalCase[];
};

export function OpsTabs({ skills, tools, runs, evalCases }: OpsTabsProps) {
  return (
    <Tabs.Root defaultValue="runs" className="ops-panel overflow-hidden">
      <Tabs.List className="flex gap-1 border-b border-border bg-card p-2" aria-label="运营面板">
        <Tabs.Trigger
          value="runs"
          className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          运行总览
        </Tabs.Trigger>
        <Tabs.Trigger
          value="skills"
          className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Skill / Tool
        </Tabs.Trigger>
        <Tabs.Trigger
          value="eval"
          className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
        >
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Eval
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="runs" className="p-4">
        {runs.length === 0 ? (
          <EmptyLine label="空状态：暂无 Agent 运行记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">输入</th>
                  <th className="py-2 pr-3 font-bold">状态</th>
                  <th className="py-2 pr-3 font-bold">步骤</th>
                  <th className="py-2 pr-3 font-bold">风险</th>
                  <th className="py-2 pr-3 font-bold">开始时间</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 6).map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="max-w-[360px] truncate py-3 pr-3 font-semibold">{run.userInput}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={run.status === "success" ? "success" : "warning"}>
                        {run.status === "success" ? "成功" : run.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3">{run.stepCount}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={run.riskLevel === "low" ? "success" : "warning"}>
                        {run.riskLevel}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{run.startedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tabs.Content>

      <Tabs.Content value="skills" className="grid gap-4 p-4 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black">Skill 配置</h2>
            <Button size="sm" variant="outline">
              测试
            </Button>
          </div>
          <div className="grid gap-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{skill.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {skill.description}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{skill.enabled ? "启用" : "停用"}</span>
                  <Switch defaultChecked={skill.enabled} aria-label={`${skill.name} 启用状态`} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black">Tool 清单</h2>
            <Button size="sm" variant="outline">
              保存
            </Button>
          </div>
          <div className="grid gap-2">
            {tools.map((tool) => (
              <div key={tool.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">{tool.name}</span>
                  <Badge tone={tool.enabled ? "success" : "neutral"}>
                    {tool.enabled ? "启用" : "停用"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
              </div>
            ))}
          </div>
        </section>
      </Tabs.Content>

      <Tabs.Content value="eval" className="p-4">
        {evalCases.length === 0 ? (
          <EmptyLine label="空状态：暂无评测用例" />
        ) : (
          <div className="grid gap-2">
            {evalCases.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black">{item.title}</span>
                  {item.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                  <Badge tone={item.enabled ? "success" : "neutral"}>
                    {item.enabled ? "启用" : "停用"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.input}</p>
              </div>
            ))}
          </div>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border bg-muted px-4 text-center text-sm font-semibold text-muted-foreground">
      {label}
    </div>
  );
}
