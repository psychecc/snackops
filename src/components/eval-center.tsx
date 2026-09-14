"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitCompareArrows,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  ToggleLeft,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvalBatch, EvalBatchComparison, EvalCaseResult } from "@/lib/eval-store";
import type { EvalCase, EvalScoreResult, EvalRunLike } from "@/lib/eval-scorer";
import type { Skill, Tool } from "@/lib/types";

type EvalOverview = {
  cases: EvalCase[];
  batches: EvalBatch[];
  skills: Skill[];
  tools: Tool[];
};

type EvalRunResult = {
  run: EvalRunLike;
  events: Array<Record<string, unknown>>;
  score: EvalScoreResult;
};

export function EvalCenter({ initialOverview }: { initialOverview: EvalOverview }) {
  const [overview, setOverview] = React.useState(initialOverview);
  const [selectedId, setSelectedId] = React.useState(initialOverview.cases[0]?.id ?? "");
  const [draft, setDraft] = React.useState<EvalCase | null>(initialOverview.cases[0] ?? null);
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [difficultyFilter, setDifficultyFilter] = React.useState("all");
  const [riskFilter, setRiskFilter] = React.useState("all");
  const [dimensionFilter, setDimensionFilter] = React.useState("all");
  const [sourceRunId, setSourceRunId] = React.useState("");
  const [runResult, setRunResult] = React.useState<EvalRunResult | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = React.useState<string[]>(
    initialOverview.cases.filter((item) => item.enabled).slice(0, 3).map((item) => item.id),
  );
  const [batchName, setBatchName] = React.useState("");
  const [versionLabel, setVersionLabel] = React.useState("baseline-v1");
  const [changeNote, setChangeNote] = React.useState("");
  const [activeBatch, setActiveBatch] = React.useState<EvalBatch | null>(initialOverview.batches[0] ?? null);
  const [baselineBatchId, setBaselineBatchId] = React.useState(initialOverview.batches[0]?.id ?? "");
  const [compareLeftId, setCompareLeftId] = React.useState(initialOverview.batches[1]?.id ?? initialOverview.batches[0]?.id ?? "");
  const [compareRightId, setCompareRightId] = React.useState(initialOverview.batches[0]?.id ?? "");
  const [comparison, setComparison] = React.useState<EvalBatchComparison | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");

  const categories = unique(overview.cases.map((item) => item.category));
  const dimensions = unique(overview.cases.flatMap((item) => item.evalDimension));
  const filteredCases = overview.cases
    .filter((item) => (categoryFilter === "all" ? true : item.category === categoryFilter))
    .filter((item) => (difficultyFilter === "all" ? true : item.difficulty === difficultyFilter))
    .filter((item) => (riskFilter === "all" ? true : item.riskLevel === riskFilter))
    .filter((item) => (dimensionFilter === "all" ? true : item.evalDimension.includes(dimensionFilter)));
  const enabledCases = overview.cases.filter((item) => item.enabled);
  const terminalActiveBatch = activeBatch ? isTerminalBatch(activeBatch.status) : true;

  React.useEffect(() => {
    const batchId = activeBatch?.id;
    const status = activeBatch?.status;

    if (!batchId || !status || isTerminalBatch(status)) return;

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/eval/batch/${encodeURIComponent(batchId)}`);
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "读取批次失败");
          setActiveBatch(payload.batch);
          setOverview((current) => upsertBatch(current, payload.batch));
        } catch (pollError) {
          const message = pollError instanceof Error ? pollError.message : String(pollError);
          setError(message);
          toast.error(message);
        }
      })();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeBatch?.id, activeBatch?.status]);

  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const response = await fetch("/api/eval");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Eval 刷新失败");
      const nextOverview = {
        cases: payload.cases as EvalCase[],
        batches: payload.batches as EvalBatch[],
        skills: payload.skills as Skill[],
        tools: payload.tools as Tool[],
      };
      setOverview(nextOverview);
      const next = nextOverview.cases.find((item) => item.id === selectedId) ?? nextOverview.cases[0] ?? null;
      setSelectedId(next?.id ?? "");
      setDraft(next);
      if (activeBatch) {
        setActiveBatch(nextOverview.batches.find((item) => item.id === activeBatch.id) ?? activeBatch);
      }
      toast.success("Eval 已刷新");
    } catch (refreshError) {
      showError(refreshError);
    } finally {
      setBusy("");
    }
  }

  async function createCase() {
    setBusy("create");
    setError("");
    try {
      const response = await fetch("/api/eval/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft ?? { name: "新评测用例", question: "推荐一款办公室零食" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "新增失败");
      toast.success("EvalCase 已新增");
      await refresh();
      selectCase(payload.case);
    } catch (createError) {
      showError(createError);
    } finally {
      setBusy("");
    }
  }

  async function createFromRun() {
    if (!sourceRunId.trim()) {
      setError("sourceRunId 不能为空");
      return;
    }
    setBusy("from-run");
    setError("");
    try {
      const response = await fetch("/api/eval/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRunId, name: `Run 沉淀：${sourceRunId}` }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "从 Run 创建失败");
      toast.success("已从 Run 加入评测集");
      await refresh();
      selectCase(payload.case);
    } catch (runError) {
      showError(runError);
    } finally {
      setBusy("");
    }
  }

  async function saveCase() {
    if (!draft) return;
    setBusy("save");
    setError("");
    try {
      const response = await fetch(`/api/eval/cases/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "保存失败");
      toast.success("EvalCase 已保存");
      await refresh();
      selectCase(payload.case);
    } catch (saveError) {
      showError(saveError);
    } finally {
      setBusy("");
    }
  }

  async function copyCase() {
    if (!draft) return;
    setBusy("copy");
    setError("");
    try {
      const response = await fetch("/api/eval/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyFromId: draft.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "复制失败");
      toast.success("EvalCase 已复制");
      await refresh();
      selectCase(payload.case);
    } catch (copyError) {
      showError(copyError);
    } finally {
      setBusy("");
    }
  }

  async function toggleCase() {
    if (!draft) return;
    setDraft({ ...draft, enabled: !draft.enabled });
    await patchCase(draft.id, { enabled: !draft.enabled }, draft.enabled ? "已停用" : "已启用");
  }

  async function deleteCase() {
    if (!draft) return;
    const confirmed = window.confirm(`确认删除评测用例：${draft.name}？`);
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    try {
      const response = await fetch(`/api/eval/cases/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "删除失败");
      toast.success("EvalCase 已删除");
      await refresh();
      setRunResult(null);
    } catch (deleteError) {
      showError(deleteError);
    } finally {
      setBusy("");
    }
  }

  async function runSingleCase() {
    if (!draft) return;
    setBusy("run");
    setError("");
    setRunResult(null);
    try {
      const agentResponse = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: draft.question,
          source: "eval",
          mandatoryCapabilities: draft.requiredCapabilities,
        }),
      });
      const agentPayload = await agentResponse.json();
      if (!agentResponse.ok) throw new Error(agentPayload.error ?? "Agent 运行失败");
      const scoreResponse = await fetch("/api/eval/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: draft.id, run: agentPayload.run }),
      });
      const scorePayload = await scoreResponse.json();
      if (!scoreResponse.ok) throw new Error(scorePayload.error ?? "评分失败");
      setRunResult({ run: agentPayload.run, events: agentPayload.events ?? [], score: scorePayload.score });
      toast.success(`单条测试完成：${scorePayload.score.status}`);
      await refresh();
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      setError(message);
      setRunResult({
        run: {
          id: "",
          question: draft.question,
          status: "failed",
          finalReply: "",
          durationMs: 0,
          error: message,
          plan: null,
          steps: [],
          riskResult: null,
        },
        events: [],
        score: {
          status: "ERROR",
          passed: false,
          reason: message,
          evidence: [message],
          keywordHits: [],
          keywordMisses: [],
          forbiddenHits: [],
          expectedPrice: draft.expectedPrice,
          mentionedPrice: null,
          riskIssues: [],
          capabilityHits: { required: [], missing: draft.requiredCapabilities, forbidden: [] },
          durationMs: 0,
          runId: "",
        },
      });
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function runBatch(mode: "selected" | "enabled" | "regression") {
    setBusy(`batch-${mode}`);
    setError("");
    setComparison(null);
    try {
      const body: Record<string, unknown> = {
        name: batchName || undefined,
        versionLabel: versionLabel || undefined,
        changeNote,
      };

      if (mode === "selected") {
        body.caseIds = selectedCaseIds;
      }

      if (mode === "regression") {
        body.regressionFromBatchId = baselineBatchId;
      }

      const response = await fetch("/api/eval/batch/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "批次创建失败");
      setActiveBatch(payload.batch);
      setCompareRightId(payload.batchId);
      setOverview((current) => upsertBatch(current, payload.batch));
      toast.success(`批次已创建：${payload.batchId}`);
    } catch (batchError) {
      showError(batchError);
    } finally {
      setBusy("");
    }
  }

  async function loadBatch(id: string, silent = false) {
    if (!silent) setBusy("load-batch");
    try {
      const response = await fetch(`/api/eval/batch/${encodeURIComponent(id)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "读取批次失败");
      setActiveBatch(payload.batch);
      setOverview((current) => upsertBatch(current, payload.batch));
      if (!silent) toast.success("批次报告已加载");
    } catch (batchError) {
      showError(batchError);
    } finally {
      if (!silent) setBusy("");
    }
  }

  async function compareBatches() {
    setBusy("compare");
    setError("");
    setComparison(null);
    try {
      const response = await fetch("/api/eval/batch/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftBatchId: compareLeftId, rightBatchId: compareRightId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "批次对比失败");
      setComparison(payload.comparison);
      toast.success(payload.comparison.directlyComparable ? "批次可直接比较" : "批次条件不同，已标记不可直接比较");
    } catch (compareError) {
      showError(compareError);
    } finally {
      setBusy("");
    }
  }

  async function patchCase(id: string, patch: Partial<EvalCase>, successMessage: string) {
    setBusy("patch");
    setError("");
    try {
      const response = await fetch(`/api/eval/cases/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "更新失败");
      toast.success(successMessage);
      await refresh();
      selectCase(payload.case);
    } catch (patchError) {
      showError(patchError);
    } finally {
      setBusy("");
    }
  }

  function selectCase(evalCase: EvalCase) {
    setSelectedId(evalCase.id);
    setDraft({ ...evalCase });
    setRunResult(null);
    setError("");
  }

  function toggleSelectedCase(id: string) {
    setSelectedCaseIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function showError(value: unknown) {
    const message = value instanceof Error ? value.message : String(value);
    setError(message);
    toast.error(message);
  }

  return (
    <div className="grid gap-4">
      <section className="ops-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="info">Eval</Badge>
            <h1 className="mt-3 text-2xl font-black">评测集、批量回归和结果对比</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              单条和批量评测都调用同一个 Agent 主链路，再用确定性评分器读取本次最终回复和 Trace。当前评测方式：规则评测，Judge 未启用。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={busy === "refresh"}>
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              刷新
            </Button>
            <Button onClick={runSingleCase} disabled={!draft || busy === "run"}>
              <Play className="h-4 w-4" aria-hidden="true" />
              运行单条
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-[#e5a19b] bg-[#fff1ef] p-3 text-sm font-semibold text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <span>错误状态：{error}</span>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <aside className="ops-panel overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">评测集</h2>
              <Badge>{enabledCases.length} 启用 / {overview.cases.length} 总数</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              <FilterSelect label="分类" value={categoryFilter} options={categories} onChange={setCategoryFilter} />
              <FilterSelect label="难度" value={difficultyFilter} options={["easy", "medium", "hard"]} onChange={setDifficultyFilter} />
              <FilterSelect label="风险" value={riskFilter} options={["low", "medium", "high"]} onChange={setRiskFilter} />
              <FilterSelect label="维度" value={dimensionFilter} options={dimensions} onChange={setDimensionFilter} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedCaseIds(enabledCases.map((item) => item.id))}>
                选择启用
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedCaseIds([])}>
                清空选择
              </Button>
            </div>
          </div>
          <div className="grid max-h-[760px] gap-2 overflow-auto p-2">
            {filteredCases.length === 0 ? <EmptyState text="空状态：暂无匹配用例" /> : null}
            {filteredCases.map((item) => (
              <div
                key={item.id}
                className={`grid gap-2 rounded-md border p-3 ${selectedId === item.id ? "border-primary bg-[#fff7e8]" : "border-border bg-card"}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    aria-label={`选择 ${item.name}`}
                    className="mt-1 h-4 w-4"
                    checked={selectedCaseIds.includes(item.id)}
                    onChange={() => toggleSelectedCase(item.id)}
                    type="checkbox"
                  />
                  <button className="min-w-0 flex-1 text-left" onClick={() => selectCase(item)} type="button">
                    <span className="block truncate text-sm font-black">{item.name}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.question}</span>
                  </button>
                  <Badge tone={item.enabled ? "success" : "neutral"}>{item.enabled ? "启用" : "停用"}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge>{item.category}</Badge>
                  <Badge>{item.difficulty}</Badge>
                  <Badge tone={item.riskLevel === "high" ? "danger" : item.riskLevel === "medium" ? "warning" : "neutral"}>
                    {item.riskLevel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="grid gap-4">
          <section className="ops-panel p-4">
            {draft ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{draft.name}</h2>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{draft.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={toggleCase}>
                      <ToggleLeft className="h-4 w-4" aria-hidden="true" />
                      {draft.enabled ? "停用" : "启用"}
                    </Button>
                    <Button variant="outline" onClick={copyCase}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      复制
                    </Button>
                    <Button variant="outline" onClick={deleteCase}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      删除
                    </Button>
                    <Button variant="secondary" onClick={createCase}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      新增
                    </Button>
                    <Button onClick={saveCase}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      保存
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
                  <Field label="category" value={draft.category} onChange={(value) => setDraft({ ...draft, category: value })} />
                  <Field label="scenario" value={draft.scenario} onChange={(value) => setDraft({ ...draft, scenario: value })} />
                  <SelectField
                    label="difficulty"
                    value={draft.difficulty}
                    options={["easy", "medium", "hard"]}
                    onChange={(value) => setDraft({ ...draft, difficulty: value as EvalCase["difficulty"] })}
                  />
                  <SelectField
                    label="riskLevel"
                    value={draft.riskLevel}
                    options={["low", "medium", "high"]}
                    onChange={(value) => setDraft({ ...draft, riskLevel: value as EvalCase["riskLevel"] })}
                  />
                  <SelectField
                    label="keywordLogic"
                    value={draft.keywordLogic}
                    options={["AND", "OR"]}
                    onChange={(value) => setDraft({ ...draft, keywordLogic: value as EvalCase["keywordLogic"] })}
                  />
                </div>

                <TextArea label="question" value={draft.question} onChange={(value) => setDraft({ ...draft, question: value })} />
                <TextArea label="expectedBehavior" value={draft.expectedBehavior} onChange={(value) => setDraft({ ...draft, expectedBehavior: value })} />
                <TextArea label="expectedReply" value={draft.expectedReply ?? ""} onChange={(value) => setDraft({ ...draft, expectedReply: value || undefined })} />

                <div className="grid gap-3 md:grid-cols-2">
                  <TextArea
                    label="expectedKeywords，每行一个"
                    value={draft.expectedKeywords.join("\n")}
                    onChange={(value) => setDraft({ ...draft, expectedKeywords: splitLines(value) })}
                  />
                  <TextArea
                    label="forbiddenWords，每行一个"
                    value={draft.forbiddenWords.join("\n")}
                    onChange={(value) => setDraft({ ...draft, forbiddenWords: splitLines(value) })}
                  />
                  <TextArea
                    label="requiredCapabilities，逗号分隔"
                    value={draft.requiredCapabilities.join(", ")}
                    onChange={(value) => setDraft({ ...draft, requiredCapabilities: splitComma(value) })}
                  />
                  <TextArea
                    label="forbiddenCapabilities，逗号分隔"
                    value={draft.forbiddenCapabilities.join(", ")}
                    onChange={(value) => setDraft({ ...draft, forbiddenCapabilities: splitComma(value) })}
                  />
                  <TextArea
                    label="evalDimension，逗号分隔"
                    value={draft.evalDimension.join(", ")}
                    onChange={(value) => setDraft({ ...draft, evalDimension: splitComma(value) })}
                  />
                  <TextArea
                    label="tags，逗号分隔"
                    value={draft.tags.join(", ")}
                    onChange={(value) => setDraft({ ...draft, tags: splitComma(value) })}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <NumberField
                    label="expectedPrice"
                    value={draft.expectedPrice ?? ""}
                    onChange={(value) => setDraft({ ...draft, expectedPrice: value === "" ? null : Number(value) })}
                  />
                  <SelectField
                    label="expectRiskPassed"
                    value={draft.expectRiskPassed == null ? "null" : String(draft.expectRiskPassed)}
                    options={["null", "true", "false"]}
                    optionLabels={{ null: "不检查" }}
                    onChange={(value) => setDraft({ ...draft, expectRiskPassed: parseNullableBoolean(value) })}
                  />
                  <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
                    <input type="checkbox" checked={draft.expectReplySafe} onChange={(event) => setDraft({ ...draft, expectReplySafe: event.target.checked })} />
                    最终回复必须安全可发送
                  </label>
                </div>

                <TextArea
                  label="llmJudgePrompt，可选；未接通时结果会是 REVIEW"
                  value={draft.llmJudgePrompt ?? ""}
                  onChange={(value) => setDraft({ ...draft, llmJudgePrompt: value || undefined })}
                />

                <div className="rounded-md border border-border bg-muted p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <Field label="sourceRunId" value={sourceRunId} onChange={setSourceRunId} />
                    <div className="flex items-end">
                      <Button variant="outline" onClick={createFromRun} disabled={busy === "from-run"}>
                        从 Run 加入评测集
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState text="空状态：请选择或新增评测用例" />
            )}
          </section>

          <SingleRunPanel runResult={runResult} />

          <section className="ops-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="text-sm font-black">批量评测与进度</h2>
                  <Badge tone="info">规则评测，Judge 未启用</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  不传 caseIds 时运行全部启用用例；运行已选会保存实际 caseIds；回归运行默认复用基线批次的 caseIds。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void runBatch("enabled")} disabled={busy.startsWith("batch-") || !terminalActiveBatch}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  运行全部启用
                </Button>
                <Button onClick={() => void runBatch("selected")} disabled={selectedCaseIds.length === 0 || busy.startsWith("batch-") || !terminalActiveBatch}>
                  {busy === "batch-selected" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  运行已选 {selectedCaseIds.length}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <Field label="batch name" value={batchName} onChange={setBatchName} />
              <Field label="versionLabel" value={versionLabel} onChange={setVersionLabel} />
              <Field label="changeNote" value={changeNote} onChange={setChangeNote} />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
              <SelectField
                label="回归基线批次"
                value={baselineBatchId}
                options={overview.batches.map((batch) => batch.id)}
                optionLabels={Object.fromEntries(overview.batches.map((batch) => [batch.id, `${batch.versionLabel} · ${batch.name}`]))}
                onChange={setBaselineBatchId}
              />
              <div className="flex items-end">
                <Button variant="outline" onClick={() => void runBatch("regression")} disabled={!baselineBatchId || busy.startsWith("batch-") || !terminalActiveBatch}>
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  复用基线用例回归
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              {activeBatch ? (
                <BatchReport batch={activeBatch} onOpen={(id) => void loadBatch(id)} />
              ) : (
                <EmptyState text="空状态：创建或打开一个批次后显示进度和报告" />
              )}

              <div>
                <h3 className="text-sm font-black">最近批次</h3>
                <div className="mt-2 grid gap-2">
                  {overview.batches.length === 0 ? <EmptyState text="空状态：暂无批次" /> : null}
                  {overview.batches.slice(0, 8).map((batch) => (
                    <div key={batch.id} className="rounded-md border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button className="min-w-0 text-left" type="button" onClick={() => void loadBatch(batch.id)}>
                          <span className="block truncate text-sm font-black">{batch.versionLabel} · {batch.name}</span>
                          <span className="mt-1 block break-all text-xs text-muted-foreground">{batch.id}</span>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <BatchStatusBadge status={batch.status} />
                          <Button variant="outline" size="sm" onClick={() => void loadBatch(batch.id)}>
                            查看报告
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        total={batch.total} pass={batch.passed} fail={batch.failed} review={batch.review} error={batch.errors}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="ops-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <GitCompareArrows className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-black">批次对比</h2>
              </div>
              <Button onClick={compareBatches} disabled={!compareLeftId || !compareRightId || busy === "compare"}>
                {busy === "compare" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitCompareArrows className="h-4 w-4" aria-hidden="true" />}
                对比
              </Button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <SelectField
                label="baseline-v1 / 左侧批次"
                value={compareLeftId}
                options={overview.batches.map((batch) => batch.id)}
                optionLabels={Object.fromEntries(overview.batches.map((batch) => [batch.id, `${batch.versionLabel} · ${batch.name}`]))}
                onChange={setCompareLeftId}
              />
              <SelectField
                label="risk-fix-v2 / 右侧批次"
                value={compareRightId}
                options={overview.batches.map((batch) => batch.id)}
                optionLabels={Object.fromEntries(overview.batches.map((batch) => [batch.id, `${batch.versionLabel} · ${batch.name}`]))}
                onChange={setCompareRightId}
              />
            </div>
            {comparison ? <ComparisonPanel comparison={comparison} /> : <EmptyState text="空状态：选择两个批次后查看已修复、新增失败和回复变化" />}
          </section>
        </main>
      </section>
    </div>
  );
}

function SingleRunPanel({ runResult }: { runResult: EvalRunResult | null }) {
  return (
    <section className="ops-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black">单条测试结果</h2>
        {runResult ? <ScoreBadge status={runResult.score.status} /> : <Badge>未运行</Badge>}
      </div>
      {runResult ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3">
            <section className="rounded-md border border-border bg-card p-3">
              <h3 className="text-sm font-black">最终回复</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {runResult.run.finalReply || runResult.run.error || "无最终回复"}
              </p>
            </section>
            <section className="rounded-md border border-border bg-card p-3">
              <h3 className="text-sm font-black">评分结果</h3>
              <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
                {JSON.stringify(runResult.score, null, 2)}
              </pre>
            </section>
          </div>
          <section className="rounded-md border border-border bg-card p-3">
            <h3 className="text-sm font-black">Trace / Error</h3>
            <pre className="mt-2 max-h-[520px] overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
              {JSON.stringify({ runId: runResult.run.id, status: runResult.run.status, error: runResult.run.error, steps: runResult.run.steps, events: runResult.events }, null, 2)}
            </pre>
          </section>
        </div>
      ) : (
        <EmptyState text="空状态：运行单条后显示真实 Agent 回复、Trace 和评分证据" />
      )}
    </section>
  );
}

function BatchReport({ batch }: { batch: EvalBatch; onOpen: (id: string) => void }) {
  const progress = batch.total > 0 ? Math.round((batch.currentIndex / batch.total) * 100) : 0;
  const qualityDenominator = batch.passed + batch.failed;
  const qualityPassRate = qualityDenominator > 0 ? batch.passed / qualityDenominator : null;

  return (
    <div className="grid gap-3">
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BatchStatusBadge status={batch.status} />
              <Badge tone="info">{batch.evaluatorMode}</Badge>
              <Badge>{batch.provider} / {batch.model}</Badge>
            </div>
            <h3 className="mt-2 truncate text-base font-black">{batch.versionLabel} · {batch.name}</h3>
            <p className="mt-1 break-all text-xs text-muted-foreground">{batch.id}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>caseIds={batch.caseIds.length}</div>
            <div>createdAt={formatDate(batch.createdAt)}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>进度 {batch.currentIndex} / {batch.total}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-md bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="PASS" value={batch.passed} tone="success" />
          <Metric label="FAIL" value={batch.failed} tone="danger" />
          <Metric label="REVIEW" value={batch.review} tone="warning" />
          <Metric label="ERROR" value={batch.errors} tone="danger" />
          <Metric label="质量通过率" value={qualityPassRate == null ? "N/A" : formatRate(qualityPassRate)} tone="info" />
        </div>
        {batch.error ? (
          <div className="mt-3 rounded-md border border-[#e5a19b] bg-[#fff1ef] p-3 text-sm font-semibold text-danger">
            整批错误：{batch.error}
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          统计口径：ERROR 不进入产品质量通过率分母，REVIEW 单独展示，不算 PASS。
        </p>
      </div>

      <div className="grid gap-3">
        {batch.caseResults.length === 0 ? (
          <EmptyState text={batch.status === "queued" || batch.status === "running" ? "加载状态：批次已进入队列，正在等待首条结果" : "空状态：该批次暂无结果"} />
        ) : null}
        {batch.caseResults.map((result, index) => (
          <BatchResultCard key={`${result.caseId}-${index}`} result={result} />
        ))}
      </div>
    </div>
  );
}

function BatchResultCard({ result }: { result: EvalCaseResult }) {
  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge status={result.status} />
            <Badge>{formatDuration(result.durationMs)}</Badge>
            {result.runId ? (
              <a className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline" href={`/runs/${encodeURIComponent(result.runId)}`}>
                Trace 链接
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <Badge tone="warning">无 runId</Badge>
            )}
          </div>
          <h4 className="mt-2 text-sm font-black">{result.caseName}</h4>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{result.question}</p>
        </div>
        <p className="max-w-xl text-sm font-semibold text-muted-foreground">{result.score.reason || "无失败原因"}</p>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <h5 className="ops-label">实际最终回复</h5>
          <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-6 text-muted-foreground">
            {result.finalReply || result.error || "无最终回复"}
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <Evidence label="失败原因 / 证据" values={result.score.evidence} empty="无额外证据" />
          <Evidence label="命中关键词" values={result.score.keywordHits} empty="无命中" />
          <Evidence label="缺失关键词" values={result.score.keywordMisses} empty="无缺失" />
          <Evidence label="禁词命中" values={result.score.forbiddenHits} empty="未命中禁词" />
          <Evidence label="风险证据" values={result.score.riskIssues} empty="无风险证据" />
          <Evidence label="能力路径" values={result.capabilityPath} empty="无能力记录" />
          <div className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
            价格证据：expected={result.score.expectedPrice ?? "N/A"}，mentioned={result.score.mentionedPrice ?? "N/A"}
          </div>
        </div>
      </div>

      <details className="mt-3 rounded-md border border-border bg-muted p-3">
        <summary className="cursor-pointer text-sm font-black">展开完整 Trace JSON</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-[#211f1c] p-3 text-xs text-white">
          {JSON.stringify({ runId: result.runId, trace: result.trace, score: result.score }, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function ComparisonPanel({ comparison }: { comparison: EvalBatchComparison }) {
  return (
    <div className="mt-4 grid gap-4">
      <div className={`rounded-md border p-3 ${comparison.directlyComparable ? "border-[#8ec8a8] bg-[#edf8f2]" : "border-[#efc071] bg-[#fff4df]"}`}>
        <div className="flex flex-wrap items-center gap-2">
          {comparison.directlyComparable ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-[#805114]" aria-hidden="true" />}
          <span className="text-sm font-black">
            {comparison.directlyComparable ? "可直接比较" : "不可直接比较"}
          </span>
        </div>
        {!comparison.directlyComparable ? (
          <div className="mt-2 grid gap-1 text-sm text-[#805114]">
            {comparison.reasons.map((reason) => <p key={reason}>{reason}</p>)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-success">caseIds、用例快照、评分器、Provider、模型、参数、Skill 和 Tool hash 均一致。</p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ComparisonSide title="左侧批次" side={comparison.left} />
        <ComparisonSide title="右侧批次" side={comparison.right} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChangeList title="已修复用例" items={comparison.fixedCases} empty="暂无 FAIL -> PASS" />
        <ChangeList title="新增失败 / 回归用例" items={comparison.newFailures} empty="暂无 PASS -> FAIL" danger />
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <h3 className="text-sm font-black">状态不变但回复改变</h3>
        {comparison.unchangedButReplyChanged.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">暂无状态不变但回复变化的用例。</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {comparison.unchangedButReplyChanged.map((item) => (
              <p key={item.caseId} className="text-sm text-muted-foreground">
                {item.caseName}：{item.leftStatus}，run {item.leftRunId || "N/A"}{" -> "}{item.rightRunId || "N/A"}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <h3 className="text-sm font-black">运行条件一致性</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(comparison.consistency).map(([key, value]) => (
            <Badge key={key} tone={value ? "success" : "warning"}>{key}: {value ? "一致" : "不同"}</Badge>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          平均耗时变化：{comparison.averageDurationDeltaMs == null ? "N/A" : `${comparison.averageDurationDeltaMs} ms`}
        </p>
      </div>
    </div>
  );
}

function ComparisonSide({ title, side }: { title: string; side: EvalBatchComparison["left"] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black">{title}</h3>
        <BatchStatusBadge status={side.status} />
      </div>
      <p className="mt-2 text-sm font-semibold">{side.versionLabel} · {side.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{side.provider} / {side.model}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Metric label="PASS" value={side.counts.passed} tone="success" />
        <Metric label="FAIL" value={side.counts.failed} tone="danger" />
        <Metric label="REVIEW" value={side.counts.review} tone="warning" />
        <Metric label="ERROR" value={side.counts.error} tone="danger" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        质量通过率：{side.qualityPassRate == null ? "N/A" : formatRate(side.qualityPassRate)}；平均耗时：{side.averageDurationMs == null ? "N/A" : `${side.averageDurationMs} ms`}
      </p>
    </div>
  );
}

function ChangeList({ title, items, empty, danger = false }: { title: string; items: EvalBatchComparison["fixedCases"]; empty: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-sm font-black">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {items.map((item) => (
            <div key={item.caseId} className={`rounded-md border p-2 ${danger ? "border-[#e5a19b] bg-[#fff1ef]" : "border-[#8ec8a8] bg-[#edf8f2]"}`}>
              <p className="text-sm font-black">{item.caseName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.question}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.leftStatus}{" -> "}{item.rightStatus}；{item.leftReason || "N/A"}{" -> "}{item.rightReason || "N/A"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Evidence({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-border bg-muted p-2">
      <div className="text-xs font-black text-foreground">{label}</div>
      {values.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {values.map((value) => <Badge key={value}>{value}</Badge>)}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return (
    <div className="rounded-md border border-border bg-muted p-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-lg font-black">
        <Badge tone={tone}>{value}</Badge>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <select className="h-9 rounded-md border border-border bg-white px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">全部</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <input className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | ""; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <input className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <select className="h-10 min-w-0 rounded-md border border-border bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length === 0 ? <option value="">暂无可选项</option> : null}
        {options.map((option) => <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <textarea className="min-h-24 rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted p-5 text-center text-sm font-semibold text-muted-foreground">
      {text}
    </div>
  );
}

function BatchStatusBadge({ status }: { status: EvalBatch["status"] }) {
  if (status === "done") return <Badge tone="success">done</Badge>;
  if (status === "error") return <Badge tone="danger">error</Badge>;
  if (status === "cancelled") return <Badge tone="warning">cancelled</Badge>;
  if (status === "running") return <Badge tone="info"><Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />running</Badge>;
  return <Badge>queued</Badge>;
}

function ScoreBadge({ status }: { status: EvalScoreResult["status"] }) {
  const icon = status === "PASS"
    ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    : status === "FAIL" || status === "ERROR"
      ? <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Badge tone={badgeTone(status)} className="gap-1">{icon}{status}</Badge>;
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitComma(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseNullableBoolean(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function badgeTone(status: EvalScoreResult["status"]) {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "danger";
  if (status === "ERROR") return "danger";
  return "warning";
}

function isTerminalBatch(status: EvalBatch["status"]) {
  return status === "done" || status === "error" || status === "cancelled";
}

function upsertBatch(overview: EvalOverview, batch: EvalBatch): EvalOverview {
  const exists = overview.batches.some((item) => item.id === batch.id);
  return {
    ...overview,
    batches: exists
      ? overview.batches.map((item) => (item.id === batch.id ? batch : item))
      : [batch, ...overview.batches],
  };
}

function formatRate(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDuration(value: number) {
  return value >= 1000 ? `${Math.round(value / 100) / 10}s` : `${value}ms`;
}

function formatDate(value: string) {
  return value.replace("T", " ").slice(0, 19);
}
