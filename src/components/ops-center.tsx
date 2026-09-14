"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Download,
  FileDiff,
  FlaskConical,
  RefreshCcw,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Annotation, OpsDashboard } from "@/lib/ops-types";
import type { Skill, SkillVersion } from "@/lib/types";

type OpsCenterProps = {
  initialDashboard: OpsDashboard;
  skills: Skill[];
};

type PromptImprovementResponse = {
  improvement: NonNullable<OpsDashboard["improvements"][number]>;
};

export function OpsCenter({ initialDashboard, skills }: OpsCenterProps) {
  const [dashboard, setDashboard] = React.useState(initialDashboard);
  const [selectedRunId, setSelectedRunId] = React.useState(initialDashboard.recentRuns[0]?.id ?? "");
  const [ratingScore, setRatingScore] = React.useState(2);
  const [ratingComment, setRatingComment] = React.useState("回复未覆盖关键约束，进入 Bad Case。");
  const [ratingProblemType, setRatingProblemType] = React.useState("推荐/话术");
  const [scoreFilter, setScoreFilter] = React.useState("all");
  const [problemFilter, setProblemFilter] = React.useState("all");
  const [timeFilter, setTimeFilter] = React.useState("all");
  const [annotationStatus, setAnnotationStatus] = React.useState<Annotation["status"]>("pending");
  const [annotationLabel, setAnnotationLabel] = React.useState("低分标注");
  const [annotationNote, setAnnotationNote] = React.useState("需要沉淀为评测用例并进入改进建议。");
  const [annotationDimensions, setAnnotationDimensions] = React.useState({
    correctness: 2,
    relevance: 3,
    completeness: 2,
    safety: 3,
    tone: 3,
    overall: 2,
  });
  const [entersImprovement, setEntersImprovement] = React.useState(true);
  const [entersEval, setEntersEval] = React.useState(true);
  const defaultSkillId = skills.some((skill) => skill.id === "risk-check") ? "risk-check" : (skills[0]?.id ?? "");
  const [selectedSkillId, setSelectedSkillId] = React.useState(defaultSkillId);
  const [promptImprovement, setPromptImprovement] = React.useState<PromptImprovementResponse["improvement"] | null>(
    null,
  );
  const [rollbackVersions, setRollbackVersions] = React.useState<SkillVersion[]>(
    defaultSkillId === "risk-check" ? initialDashboard.rollbackVersions : [],
  );
  const [selectedVersionId, setSelectedVersionId] = React.useState(initialDashboard.rollbackVersions[0]?.id ?? "");
  const [abTestName, setAbTestName] = React.useState("运营中心 Prompt A/B 草案");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");

  const selectedRun = dashboard.recentRuns.find((run) => run.id === selectedRunId) ?? dashboard.recentRuns[0] ?? null;
  const problemTypes = React.useMemo(
    () => [...new Set(dashboard.ratings.map((rating) => rating.problemType).filter(Boolean))],
    [dashboard.ratings],
  );
  const filteredRatings = React.useMemo(() => {
    const since = getSinceDate(timeFilter);
    return dashboard.ratings
      .filter((rating) => (scoreFilter === "all" ? true : rating.score === Number(scoreFilter)))
      .filter((rating) => (problemFilter === "all" ? true : rating.problemType === problemFilter))
      .filter((rating) => (since ? new Date(rating.createdAt).getTime() >= since : true));
  }, [dashboard.ratings, problemFilter, scoreFilter, timeFilter]);
  const pendingAnnotations = dashboard.annotations.filter((annotation) => annotation.status === "pending");

  async function refreshDashboard() {
    setBusy("refresh");
    setError("");
    try {
      const response = await fetch("/api/ops");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "运营中心刷新失败");
      setDashboard(payload.dashboard);
      toast.success("运营中心已刷新");
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function submitRating() {
    if (!selectedRun) return;
    setBusy("rating");
    setError("");
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: selectedRun.id,
          score: ratingScore,
          label: ratingScore <= 2 ? "低分 Bad Case" : "服务评分",
          comment: ratingComment,
          problemType: ratingProblemType,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "评分保存失败");
      toast.success(ratingScore <= 2 ? "低分评分已进入改进建议" : "评分已保存");
      await refreshDashboard();
    } catch (ratingError) {
      const message = ratingError instanceof Error ? ratingError.message : String(ratingError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function submitAnnotation() {
    if (!selectedRun) return;
    setBusy("annotation");
    setError("");
    try {
      const response = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: selectedRun.id,
          status: annotationStatus,
          label: annotationLabel,
          span: selectedRun.finalReply.slice(0, 140),
          note: annotationNote,
          annotator: "ops",
          dimensions: annotationDimensions,
          entersImprovement,
          entersEval,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "标注保存失败");
      toast.success("标注已保存");
      await refreshDashboard();
    } catch (annotationError) {
      const message = annotationError instanceof Error ? annotationError.message : String(annotationError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function updateAnnotationStatus(id: string, status: Annotation["status"]) {
    setBusy(`annotation-${id}`);
    setError("");
    try {
      const response = await fetch(`/api/annotations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "标注状态更新失败");
      toast.success("标注状态已更新");
      await refreshDashboard();
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : String(statusError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function generatePromptDraft() {
    setBusy("generate");
    setError("");
    try {
      const response = await fetch("/api/improvements/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: selectedSkillId, sampleLimit: 6 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Prompt 草案生成失败");
      setPromptImprovement(payload.improvement);
      toast.success("Prompt 草案已生成，未覆盖生产 Prompt");
      await refreshDashboard();
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : String(generateError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function applyPromptDraft() {
    if (!promptImprovement?.promptDraft || !promptImprovement.skillId) return;
    const confirmed = window.confirm("确认应用 Prompt 草案？应用前会自动保存当前 Skill 版本快照。");
    if (!confirmed) return;
    setBusy("apply");
    setError("");
    try {
      const response = await fetch("/api/improvements/apply-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          improvementId: promptImprovement.id,
          skillId: promptImprovement.skillId,
          promptDraft: promptImprovement.promptDraft,
          changeNote: "运营中心确认应用 Prompt 草案",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Prompt 应用失败");
      toast.success("Prompt 已应用，应用前快照已保存");
      await loadRollbackVersions(promptImprovement.skillId);
      await refreshDashboard();
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : String(applyError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function loadRollbackVersions(skillId: string) {
    setSelectedSkillId(skillId);
    setBusy("versions");
    setError("");
    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}/versions`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "版本列表读取失败");
      setRollbackVersions(payload.versions);
      setSelectedVersionId(payload.versions[0]?.id ?? "");
    } catch (versionError) {
      const message = versionError instanceof Error ? versionError.message : String(versionError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function rollbackVersion() {
    if (!selectedSkillId || !selectedVersionId) return;
    const confirmed = window.confirm("确认回滚到选中的版本？回滚前会保存当前版本快照。");
    if (!confirmed) return;
    setBusy("rollback");
    setError("");
    try {
      const response = await fetch(
        `/api/skills/${encodeURIComponent(selectedSkillId)}/versions/${encodeURIComponent(selectedVersionId)}/rollback`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "版本回滚失败");
      toast.success("版本已回滚");
      await loadRollbackVersions(selectedSkillId);
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  async function createPromptAbTest() {
    setBusy("abtest");
    setError("");
    try {
      const response = await fetch("/api/ab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: abTestName,
          status: "draft",
          metric: "人工评分均值 + 风控通过率",
          variants: [
            { id: "A", skillId: selectedSkillId, source: "current" },
            { id: "B", skillId: selectedSkillId, source: "prompt-draft" },
          ],
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A/B 草案创建失败");
      toast.success("Prompt A/B 草案已创建");
      await refreshDashboard();
    } catch (abError) {
      const message = abError instanceof Error ? abError.message : String(abError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-4">
      <section className="ops-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="info">运营中心</Badge>
            <h1 className="mt-3 text-2xl font-black">运行结果到反馈闭环</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              从 Run 发现问题，沉淀评分和标注，进入规则聚类改进建议，再由人工确认 Prompt 应用或版本回滚。
            </p>
          </div>
          <Button variant="outline" onClick={refreshDashboard} disabled={busy === "refresh"}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            刷新
          </Button>
        </div>
        {error ? (
          <div className="mt-4 rounded-md border border-[#e5a19b] bg-[#fff1ef] p-3 text-sm font-semibold text-danger">
            错误状态：{error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4">
          <section className="ops-panel p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="运行总数" value={String(dashboard.metrics.totalRuns)} detail="RunRecord 持久化总量" />
              <Metric label="成功率" value={`${dashboard.metrics.successRate}%`} detail="status=success" />
              <Metric label="平均耗时" value={`${dashboard.metrics.averageDurationMs}ms`} detail="完整链路耗时" />
              <Metric label="人工接管率" value={`${dashboard.metrics.handoffRate}%`} detail="status=handoff" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <InsightList title="失败步骤" empty="暂无失败步骤" items={dashboard.metrics.failedSteps} />
              <InsightList title="风险等级分布" empty="暂无风险数据" items={dashboard.metrics.riskDistribution} />
            </div>
          </section>

          <section className="ops-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black">最近运行</h2>
              <Badge>{dashboard.recentRuns.length} 条</Badge>
            </div>
            <div className="grid gap-2">
              {dashboard.recentRuns.length === 0 ? (
                <EmptyState text="空状态：暂无运行记录" />
              ) : (
                dashboard.recentRuns.map((run) => (
                  <button
                    key={run.id}
                    className={`grid gap-2 rounded-md border p-3 text-left ${selectedRunId === run.id ? "border-primary bg-[#fff7e8]" : "border-border bg-card"}`}
                    onClick={() => setSelectedRunId(run.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black">{run.question || run.id}</span>
                      <div className="flex gap-2">
                        <Badge tone={run.status === "success" ? "success" : run.status === "handoff" ? "warning" : "danger"}>
                          {run.status}
                        </Badge>
                        <Link
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                          href={`/runs/${encodeURIComponent(run.id)}`}
                        >
                          详情 <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{run.finalReply || run.error || "无回复"}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4">
          <section className="ops-panel p-4">
            <h2 className="text-sm font-black">服务评分</h2>
            <p className="mt-1 text-xs text-muted-foreground">低分会自动进入 Bad Case 和改进建议。</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <SelectRun selectedRunId={selectedRunId} runs={dashboard.recentRuns} onChange={setSelectedRunId} />
              <NumberField label="评分" value={ratingScore} onChange={setRatingScore} />
              <Field label="问题类型" value={ratingProblemType} onChange={setRatingProblemType} />
            </div>
            <textarea
              className="mt-3 min-h-20 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={ratingComment}
              onChange={(event) => setRatingComment(event.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={submitRating} disabled={!selectedRun || busy === "rating"}>
                <Save className="h-4 w-4" aria-hidden="true" />
                保存评分
              </Button>
            </div>
          </section>

          <section className="ops-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black">评分筛选</h2>
              <Badge>{filteredRatings.length} 条</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value)}>
                <option value="all">全部评分</option>
                {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} 分</option>)}
              </select>
              <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={problemFilter} onChange={(event) => setProblemFilter(event.target.value)}>
                <option value="all">全部类型</option>
                {problemTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
                <option value="all">全部时间</option>
                <option value="24h">最近 24 小时</option>
                <option value="7d">最近 7 天</option>
              </select>
            </div>
            <ListBlock
              empty="空状态：暂无匹配评分"
              rows={filteredRatings.map((rating) => ({
                id: rating.id,
                title: `${rating.score} 分 / ${rating.problemType}`,
                body: rating.comment || rating.label,
                meta: rating.createdAt,
              }))}
            />
          </section>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="ops-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">数据标注</h2>
              <p className="mt-1 text-xs text-muted-foreground">支持进入改进建议或评测集。</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/api/annotations/export">
                <Download className="h-4 w-4" aria-hidden="true" />
                导出标注
              </Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <SelectRun selectedRunId={selectedRunId} runs={dashboard.recentRuns} onChange={setSelectedRunId} />
            <Field label="标签" value={annotationLabel} onChange={setAnnotationLabel} />
            <label className="grid gap-1">
              <span className="ops-label">状态</span>
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={annotationStatus}
                onChange={(event) => setAnnotationStatus(event.target.value as Annotation["status"])}
              >
                <option value="pending">pending</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(annotationDimensions).map(([key, value]) => (
              <NumberField
                key={key}
                label={key}
                value={value}
                onChange={(next) => setAnnotationDimensions((current) => ({ ...current, [key]: next }))}
              />
            ))}
          </div>
          <textarea
            className="mt-3 min-h-20 w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={annotationNote}
            onChange={(event) => setAnnotationNote(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={entersImprovement} onChange={(event) => setEntersImprovement(event.target.checked)} />
              进入改进建议
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={entersEval} onChange={(event) => setEntersEval(event.target.checked)} />
              沉淀评测用例
            </label>
            <Button onClick={submitAnnotation} disabled={!selectedRun || busy === "annotation"}>
              <Save className="h-4 w-4" aria-hidden="true" />
              保存标注
            </Button>
          </div>
        </section>

        <section className="ops-panel p-4">
          <h2 className="text-sm font-black">人工评估队列</h2>
          <ListBlock
            empty="空状态：暂无 pending 标注"
            rows={pendingAnnotations.map((annotation) => ({
              id: annotation.id,
              title: `${annotation.label} / overall ${annotation.dimensions.overall}`,
              body: annotation.note || annotation.span,
              meta: annotation.createdAt,
              action: (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => updateAnnotationStatus(annotation.id, "accepted")}>
                    接受
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateAnnotationStatus(annotation.id, "rejected")}>
                    拒绝
                  </Button>
                </div>
              ),
            }))}
          />
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <section className="ops-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black">改进建议中心</h2>
              <p className="mt-1 text-xs text-muted-foreground">规则聚类，非 LLM 自动分析；生成草案不会覆盖生产 Prompt。</p>
            </div>
            <Button onClick={generatePromptDraft} disabled={!selectedSkillId || busy === "generate"}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              生成 Prompt 草案
            </Button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr]">
            <label className="grid gap-1">
              <span className="ops-label">目标 Skill</span>
              <select
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                value={selectedSkillId}
                onChange={(event) => void loadRollbackVersions(event.target.value)}
              >
                {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name} / {skill.id}</option>)}
              </select>
            </label>
            <div className="rounded-md border border-border bg-muted p-3 text-xs font-semibold text-muted-foreground">
              聚类方式：规则聚类。低评分、Bad Case、低分标注会被聚合到 Planner / Skill / Tool / Eval 四类方向。
            </div>
          </div>
          {promptImprovement ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-[#211f1c] p-3 text-xs text-white">
                {promptImprovement.diff || "暂无 diff"}
              </pre>
              <div className="grid gap-3">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-[#211f1c] p-3 text-xs text-white">
                  {promptImprovement.promptDraft}
                </pre>
                <Button onClick={applyPromptDraft} disabled={busy === "apply"}>
                  <FileDiff className="h-4 w-4" aria-hidden="true" />
                  确认应用草案
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState text="空状态：尚未生成 Prompt 草案" />
          )}
        </section>

        <section className="ops-panel p-4">
          <h2 className="text-sm font-black">版本回滚</h2>
          <p className="mt-1 text-xs text-muted-foreground">回滚前会自动保存当前版本快照。</p>
          <div className="mt-3 grid gap-3">
            <select className="h-10 rounded-md border border-border bg-white px-3 text-sm" value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
              {rollbackVersions.length === 0 ? <option value="">暂无版本</option> : null}
              {rollbackVersions.map((version) => (
                <option key={version.id} value={version.id}>{version.version} / {version.changeNote} / {version.createdAt}</option>
              ))}
            </select>
            <Button variant="outline" onClick={rollbackVersion} disabled={!selectedVersionId || busy === "rollback"}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              回滚版本
            </Button>
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="ops-panel p-4">
          <h2 className="text-sm font-black">Prompt A/B</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="h-10 flex-1 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={abTestName}
              onChange={(event) => setAbTestName(event.target.value)}
            />
            <Button onClick={createPromptAbTest} disabled={busy === "abtest"}>
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              创建草案
            </Button>
          </div>
          <ListBlock
            empty="空状态：暂无 A/B 测试"
            rows={dashboard.abTests.map((test) => ({
              id: test.id,
              title: `${test.name} / ${test.status}`,
              body: `metric=${test.metric} variants=${test.variants.length}`,
              meta: test.createdAt,
            }))}
          />
        </section>

        <section className="ops-panel p-4">
          <h2 className="text-sm font-black">改进记录</h2>
          <ListBlock
            empty="空状态：暂无改进记录"
            rows={dashboard.improvements.map((item) => ({
              id: item.id,
              title: `${item.targetType} / ${item.status} / ${item.clusterMethod}`,
              body: item.proposal || item.title,
              meta: `${item.source}:${item.sourceId}`,
            }))}
          />
        </section>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function InsightList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ capabilityId?: string; riskLevel?: string; count: number }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h3 className="text-sm font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? <EmptyState text={empty} compact /> : null}
        {items.map((item) => {
          const label = item.capabilityId ?? item.riskLevel ?? "unknown";
          return (
            <div key={label} className="grid gap-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, item.count * 12)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectRun({
  selectedRunId,
  runs,
  onChange,
}: {
  selectedRunId: string;
  runs: OpsDashboard["recentRuns"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">Run</span>
      <select
        className="h-10 rounded-md border border-border bg-white px-3 text-sm"
        value={selectedRunId}
        onChange={(event) => onChange(event.target.value)}
      >
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.id}
          </option>
        ))}
      </select>
    </label>
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="ops-label">{label}</span>
      <input
        className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        max={5}
        min={1}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ListBlock({
  empty,
  rows,
}: {
  empty: string;
  rows: Array<{ id: string; title: string; body: string; meta: string; action?: React.ReactNode }>;
}) {
  return (
    <div className="mt-3 grid max-h-96 gap-2 overflow-auto">
      {rows.length === 0 ? <EmptyState text={empty} /> : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-black">{row.title}</span>
            <span className="text-xs font-semibold text-muted-foreground">{row.meta}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.body}</p>
          {row.action}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-md border border-dashed border-border bg-muted text-center text-sm font-semibold text-muted-foreground ${compact ? "p-3" : "p-5"}`}
    >
      {text}
    </div>
  );
}

function getSinceDate(value: string) {
  if (value === "24h") return Date.now() - 24 * 60 * 60 * 1000;
  if (value === "7d") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  return null;
}
