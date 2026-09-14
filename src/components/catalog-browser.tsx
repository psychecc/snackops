"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { CatalogSummary } from "@/lib/types";

export function CatalogBrowser({ summaries }: { summaries: CatalogSummary[] }) {
  const [selectedId, setSelectedId] = React.useState(summaries[0]?.id ?? "");
  const selected = summaries.find((summary) => summary.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="ops-panel overflow-hidden">
        <div className="border-b border-border p-3">
          <h2 className="text-sm font-black">数据类型</h2>
          <p className="mt-1 text-xs text-muted-foreground">当前 {summaries.length} 类业务数据</p>
        </div>
        <div className="p-2">
          {summaries.map((summary) => (
            <button
              key={summary.id}
              className="mb-2 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-left hover:bg-muted"
              onClick={() => setSelectedId(summary.id)}
              type="button"
            >
              <span>
                <span className="block text-sm font-black">{summary.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{summary.file}</span>
              </span>
              <Badge tone={summary.count > 0 ? "success" : "neutral"}>{summary.count} 条</Badge>
            </button>
          ))}
        </div>
      </section>

      <section className="ops-panel p-4">
        {selected ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black">{selected.label}</h1>
                <p className="mt-1 text-xs text-muted-foreground">{selected.file}</p>
              </div>
              <Badge tone="info">{selected.count} 条记录</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.fields.map((field) => (
                <Badge key={field}>{field}</Badge>
              ))}
            </div>
            <pre className="max-h-[640px] overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
              {JSON.stringify(selected.sample, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted p-8 text-center text-sm font-semibold text-muted-foreground">
            空状态：暂无数据目录
          </div>
        )}
      </section>
    </div>
  );
}
