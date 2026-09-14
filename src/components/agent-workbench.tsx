"use client";

import * as React from "react";
import Link from "next/link";
import { Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RunRecord } from "@/lib/types";

type AgentResponse = {
  ok: boolean;
  run: RunRecord;
  events: Array<Record<string, unknown>>;
};

export function AgentWorkbench() {
  const [question, setQuestion] = React.useState("想买办公室下午茶，酸甜一点，预算100元以内，有优惠吗？");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<AgentResponse | null>(null);

  async function runAgent(extra?: Record<string, unknown>) {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: question, source: "workbench", ...extra }),
      });
      const payload = (await response.json()) as AgentResponse;
      setResult(payload);
      toast[response.ok ? "success" : "error"](response.ok ? "运行完成" : "运行失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="ops-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="info">Agent Workbench</Badge>
            <h1 className="mt-3 text-2xl font-black">Agent 执行工作台</h1>
          </div>
          <Button onClick={() => runAgent()} disabled={running}>
            <Play className="h-4 w-4" aria-hidden="true" />
            {running ? "运行中" : "运行"}
          </Button>
        </div>
        <textarea
          className="mt-4 min-h-28 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setQuestion("SO202607180007 这个订单物流到哪了？")}>
            物流样例
          </Button>
          <Button variant="outline" onClick={() => setQuestion("有人说我中奖了，要我转保证金和验证码，是真的吗？")}>
            风险样例
          </Button>
          <Button variant="outline" onClick={() => runAgent({ forceToolError: "query_products" })}>
            Tool 错误样例
          </Button>
        </div>
      </section>

      {result ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="ops-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">最终回复</h2>
              <Badge tone={result.run.status === "success" ? "success" : "warning"}>{result.run.status}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{result.run.finalReply || result.run.error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={result.run.riskResult?.riskLevel === "high" ? "danger" : "success"}>
                风险：{result.run.riskResult?.riskLevel ?? "unknown"}
              </Badge>
              <Badge>Provider：{result.run.provider}</Badge>
              <Badge>耗时：{result.run.durationMs}ms</Badge>
            </div>
            <Button asChild className="mt-4" variant="outline">
              <Link href={`/runs/${result.run.id}`}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                查看详情
              </Link>
            </Button>
          </section>

          <section className="ops-panel p-4">
            <h2 className="text-lg font-black">Plan</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {result.run.plan?.selectedSkills.map((id) => <Badge key={id}>{id}</Badge>)}
              {result.run.plan?.selectedTools.map((id) => <Badge key={id} tone="info">{id}</Badge>)}
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
              {JSON.stringify(result.run.plan, null, 2)}
            </pre>
          </section>

          <section className="ops-panel p-4 lg:col-span-2">
            <h2 className="text-lg font-black">Trace</h2>
            <div className="mt-3 grid gap-2">
              {result.run.steps.map((step) => (
                <details key={`${step.stepId}-${step.capabilityId}`} className="rounded-md border border-border bg-card p-3">
                  <summary className="cursor-pointer text-sm font-black">
                    {step.stepId} · {step.type} · {step.capabilityId} · {step.status} · {step.durationMs}ms
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                    {JSON.stringify(step, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="ops-panel flex min-h-56 items-center justify-center p-6 text-sm font-semibold text-muted-foreground">
          空状态：等待 Agent 运行
        </section>
      )}
    </div>
  );
}
