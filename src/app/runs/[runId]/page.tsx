import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { RunDetailActions } from "@/components/run-detail-actions";
import { getRunRecord } from "@/lib/run-store";

type RunDetailPageProps = {
  params: Promise<{
    runId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { runId } = await params;
  const run = await getRunRecord(decodeURIComponent(runId));

  if (!run) {
    notFound();
  }

  return (
    <div className="grid gap-5">
      <section className="ops-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone={run.status === "success" ? "success" : "warning"}>{run.status}</Badge>
            <h1 className="mt-3 text-2xl font-black">{run.question}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {run.id} · {run.createdAt} · {run.durationMs}ms
            </p>
          </div>
          <Badge>Provider：{run.provider}</Badge>
        </div>
      </section>

      <RunDetailActions runId={run.id} />

      <section className="ops-panel p-4">
        <h2 className="text-lg font-black">最终回复</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{run.finalReply || run.error}</p>
      </section>

      <section className="ops-panel p-4">
        <h2 className="text-lg font-black">Plan</h2>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
          {JSON.stringify(run.plan, null, 2)}
        </pre>
      </section>

      <section className="ops-panel p-4">
        <h2 className="text-lg font-black">Trace</h2>
        <div className="mt-3 grid gap-2">
          {run.steps.map((step) => (
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
  );
}
