import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getRunRecord, listRunRecords } from "@/lib/run-store";
import {
  getSkill,
  getSkillVersion,
  listSkillVersions,
  updateSkill,
} from "@/lib/skill-registry";
import { readJsonFile, updateJsonFile } from "@/lib/store";
import type {
  AbTest,
  Annotation,
  AnnotationDimensions,
  AnnotationStatus,
  Improvement,
  ImprovementTargetType,
  OpsDashboard,
  Rating,
} from "@/lib/ops-types";
import type { RunRecord } from "@/lib/types";

const RATINGS_FILE = "ratings.json";
const ANNOTATIONS_FILE = "annotations.json";
const IMPROVEMENTS_FILE = "improvements.json";
const EVAL_CASES_FILE = "eval_cases.json";
const AB_TESTS_FILE = "ab-tests.json";

const ratingInputSchema = z.object({
  runId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  label: z.string().optional(),
  comment: z.string().optional(),
  problemType: z.string().optional(),
});

const dimensionsSchema = z.object({
  correctness: z.number().int().min(1).max(5).default(3),
  relevance: z.number().int().min(1).max(5).default(3),
  completeness: z.number().int().min(1).max(5).default(3),
  safety: z.number().int().min(1).max(5).default(3),
  tone: z.number().int().min(1).max(5).default(3),
  overall: z.number().int().min(1).max(5).default(3),
});

const annotationInputSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
  label: z.string().optional(),
  span: z.string().optional(),
  note: z.string().optional(),
  annotator: z.string().optional(),
  dimensions: dimensionsSchema.partial().optional(),
  entersImprovement: z.boolean().optional(),
  entersEval: z.boolean().optional(),
});

const annotationPatchSchema = annotationInputSchema.partial().omit({ runId: true });

const abTestInputSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["draft", "running", "paused", "completed"]).default("draft"),
  variants: z.array(z.record(z.unknown())).default([]),
  metric: z.string().default("人工评分均值"),
});

export async function getOpsDashboard(): Promise<OpsDashboard> {
  const [{ runs }, ratings, annotations, improvements, abTests, rollbackVersions] = await Promise.all([
    listRunRecords(200, 1),
    listRatings(),
    listAnnotations(),
    listImprovements(),
    listAbTests(),
    listSkillVersions("risk-check"),
  ]);

  return {
    metrics: createMetrics(runs),
    recentRuns: runs.slice(0, 12),
    ratings: ratings.slice(0, 20),
    annotations: annotations.slice(0, 20),
    improvements: improvements.slice(0, 20),
    abTests,
    rollbackVersions: rollbackVersions.slice(0, 8),
  };
}

export async function listRatings(filters?: {
  score?: number;
  problemType?: string;
  since?: string;
}) {
  const raw = await readJsonFile<unknown[]>(RATINGS_FILE, []);
  return raw
    .map(normalizeRating)
    .filter((rating) => (filters?.score ? rating.score === filters.score : true))
    .filter((rating) => (filters?.problemType ? rating.problemType === filters.problemType : true))
    .filter((rating) => (filters?.since ? rating.createdAt >= filters.since : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createRating(input: unknown) {
  const parsed = ratingInputSchema.parse(input);
  const run = await requireRun(parsed.runId);
  const rating: Rating = {
    id: `rt_${Date.now()}_${randomUUID().slice(0, 8)}`,
    runId: parsed.runId,
    score: parsed.score,
    label: parsed.label ?? (parsed.score <= 2 ? "低分 Bad Case" : "服务评分"),
    comment: parsed.comment ?? "",
    question: run.question,
    answer: run.finalReply,
    problemType: parsed.problemType ?? inferProblemType(run),
    createdAt: new Date().toISOString(),
  };

  await updateJsonFile<unknown[]>(RATINGS_FILE, (ratings) => [...ratings, rating], []);

  if (rating.score <= 2) {
    await createImprovementFromRating(rating, run);
  }

  return rating;
}

export async function listAnnotations(filters?: {
  status?: AnnotationStatus;
  runId?: string;
}) {
  const raw = await readJsonFile<unknown[]>(ANNOTATIONS_FILE, []);
  return raw
    .map(normalizeAnnotation)
    .filter((annotation) => (filters?.status ? annotation.status === filters.status : true))
    .filter((annotation) => (filters?.runId ? annotation.runId === filters.runId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAnnotation(input: unknown) {
  const parsed = annotationInputSchema.parse(input);
  const run = await requireRun(parsed.runId);
  const dimensions = normalizeDimensions(parsed.dimensions);
  const shouldEnterImprovement =
    parsed.entersImprovement ?? (dimensions.overall <= 2 || dimensions.safety <= 2);
  const annotation: Annotation = {
    id: `ann_${Date.now()}_${randomUUID().slice(0, 8)}`,
    runId: parsed.runId,
    status: parsed.status,
    label: parsed.label ?? "人工标注",
    span: parsed.span ?? run.finalReply.slice(0, 120),
    note: parsed.note ?? "",
    annotator: parsed.annotator ?? "ops",
    dimensions,
    entersImprovement: shouldEnterImprovement,
    entersEval: parsed.entersEval ?? false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await updateJsonFile<unknown[]>(ANNOTATIONS_FILE, (annotations) => [...annotations, annotation], []);

  if (annotation.entersImprovement) {
    await createImprovementFromAnnotation(annotation, run);
  }

  if (annotation.entersEval) {
    await createEvalCaseFromAnnotation(annotation, run);
  }

  return annotation;
}

export async function updateAnnotation(id: string, input: unknown) {
  const patch = annotationPatchSchema.parse(input);
  let updated: Annotation | null = null;
  await updateJsonFile<unknown[]>(
    ANNOTATIONS_FILE,
    (annotations) =>
      annotations.map((value) => {
        const current = normalizeAnnotation(value);
        if (current.id !== id) {
          return current;
        }

        updated = {
          ...current,
          ...patch,
          dimensions: normalizeDimensions({ ...current.dimensions, ...patch.dimensions }),
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    [],
  );

  if (!updated) {
    throw new Error(`Annotation not found: ${id}`);
  }

  return updated;
}

export async function listImprovements() {
  const raw = await readJsonFile<unknown[]>(IMPROVEMENTS_FILE, []);
  return raw.map(normalizeImprovement).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function generatePromptImprovement(input: unknown) {
  const body = z
    .object({
      skillId: z.string().default("risk-check"),
      sampleLimit: z.number().int().min(1).max(20).default(6),
    })
    .parse(input ?? {});
  const skill = await getSkill(body.skillId);

  if (!skill) {
    throw new Error(`Skill not found: ${body.skillId}`);
  }

  const [ratings, annotations, { runs }] = await Promise.all([
    listRatings(),
    listAnnotations(),
    listRunRecords(200, 1),
  ]);
  const runMap = new Map(runs.map((run) => [run.id, run]));
  const lowRatings = ratings.filter((rating) => rating.score <= 2).slice(0, body.sampleLimit);
  const lowAnnotations = annotations
    .filter((annotation) => annotation.dimensions.overall <= 2 || annotation.dimensions.safety <= 2)
    .slice(0, body.sampleLimit);
  const sampleRunIds = [...new Set([...lowRatings.map((item) => item.runId), ...lowAnnotations.map((item) => item.runId)])]
    .filter((runId) => runMap.has(runId))
    .slice(0, body.sampleLimit);
  const samples = sampleRunIds.map((runId) => runMap.get(runId)).filter(Boolean) as RunRecord[];
  const targetType = inferImprovementTarget(samples, lowRatings, lowAnnotations);
  const promptDraft = createPromptDraft(skill.systemPrompt ?? "", samples, lowRatings, lowAnnotations);
  const diff = createAppendDiff(skill.systemPrompt ?? "", promptDraft);
  const improvement: Improvement = {
    id: `imp_${Date.now()}_${randomUUID().slice(0, 8)}`,
    source: "rule-cluster",
    sourceId: lowRatings[0]?.id ?? lowAnnotations[0]?.id ?? "manual",
    title: `规则聚类：${skill.name} Prompt 改进草案`,
    targetType,
    targetId: body.skillId,
    skillId: body.skillId,
    status: "draft",
    clusterMethod: "规则聚类",
    sampleRunIds,
    proposal: "根据低评分、低分标注和 Bad Case 规则聚类生成 Prompt 草案。该草案不会自动覆盖生产 Prompt。",
    promptDraft,
    diff,
    createdAt: new Date().toISOString(),
  };

  await updateJsonFile<unknown[]>(
    IMPROVEMENTS_FILE,
    (improvements) => [...improvements.map(normalizeImprovement), improvement],
    [],
  );

  return improvement;
}

export async function applyPromptImprovement(input: unknown) {
  const body = z
    .object({
      improvementId: z.string().optional(),
      skillId: z.string().min(1),
      promptDraft: z.string().min(1),
      changeNote: z.string().optional(),
    })
    .parse(input);
  const skill = await updateSkill(body.skillId, {
    systemPrompt: body.promptDraft,
    changeNote: body.changeNote ?? "应用运营中心 Prompt 改进，应用前自动保存 Skill 版本快照",
  });
  let improvement: Improvement | null = null;

  if (body.improvementId) {
    await updateJsonFile<unknown[]>(
      IMPROVEMENTS_FILE,
      (improvements) =>
        improvements.map((item) => {
          const current = normalizeImprovement(item);
          if (current.id !== body.improvementId) {
            return current;
          }
          improvement = {
            ...current,
            status: "applied",
            promptDraft: body.promptDraft,
            appliedAt: new Date().toISOString(),
          };
          return improvement;
        }),
      [],
    );
  }

  return { skill, improvement };
}

export async function rollbackSkillPrompt(skillId: string, versionId: string) {
  const version = await getSkillVersion(skillId, versionId);

  if (!version) {
    throw new Error(`Skill version not found: ${versionId}`);
  }

  return updateSkill(skillId, {
    name: version.metadata.name,
    description: version.metadata.description,
    enabled: version.metadata.enabled,
    model: version.metadata.model,
    temperature: version.metadata.temperature,
    maxTokens: version.metadata.maxTokens,
    requiredTools: version.metadata.requiredTools,
    version: version.metadata.version,
    filePath: version.metadata.filePath,
    systemPrompt: version.systemPrompt,
    changeNote: `版本回滚到 ${version.version}，回滚前自动保存当前版本快照`,
  });
}

export async function listAbTests() {
  const raw = await readJsonFile<unknown[]>(AB_TESTS_FILE, []);
  return raw.map(normalizeAbTest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAbTest(input: unknown) {
  const parsed = abTestInputSchema.parse(input);
  const abTest: AbTest = {
    id: `abt_${Date.now()}_${randomUUID().slice(0, 8)}`,
    name: parsed.name,
    status: parsed.status,
    variants: parsed.variants,
    metric: parsed.metric,
    createdAt: new Date().toISOString(),
  };

  await updateJsonFile<unknown[]>(AB_TESTS_FILE, (tests) => [...tests.map(normalizeAbTest), abTest], []);
  return abTest;
}

function createMetrics(runs: RunRecord[]) {
  const totalRuns = runs.length;
  const successRuns = runs.filter((run) => run.status === "success").length;
  const handoffRuns = runs.filter((run) => run.status === "handoff").length;
  const averageDurationMs =
    totalRuns === 0 ? 0 : Math.round(runs.reduce((sum, run) => sum + run.durationMs, 0) / totalRuns);
  const failedStepMap = new Map<string, number>();
  const riskMap = new Map<string, number>();

  for (const run of runs) {
    const riskLevel = run.riskResult?.riskLevel ?? "unknown";
    riskMap.set(riskLevel, (riskMap.get(riskLevel) ?? 0) + 1);

    for (const step of run.steps) {
      if (step.status === "error" || step.status === "blocked") {
        failedStepMap.set(step.capabilityId, (failedStepMap.get(step.capabilityId) ?? 0) + 1);
      }
    }
  }

  return {
    totalRuns,
    successRate: totalRuns === 0 ? 0 : Math.round((successRuns / totalRuns) * 1000) / 10,
    averageDurationMs,
    handoffRate: totalRuns === 0 ? 0 : Math.round((handoffRuns / totalRuns) * 1000) / 10,
    failedSteps: [...failedStepMap.entries()]
      .map(([capabilityId, count]) => ({ capabilityId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    riskDistribution: [...riskMap.entries()].map(([riskLevel, count]) => ({ riskLevel, count })),
  };
}

async function requireRun(runId: string) {
  const run = await getRunRecord(runId);

  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  return run;
}

function normalizeRating(value: unknown): Rating {
  const item = value as Record<string, unknown>;
  return {
    id: String(item.id ?? `rt_${randomUUID().slice(0, 8)}`),
    runId: String(item.runId ?? ""),
    score: clampScore(item.score),
    label: String(item.label ?? "服务评分"),
    comment: String(item.comment ?? ""),
    question: String(item.question ?? ""),
    answer: String(item.answer ?? ""),
    problemType: String(item.problemType ?? item.label ?? "未分类"),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
  };
}

function normalizeAnnotation(value: unknown): Annotation {
  const item = value as Record<string, unknown>;
  return {
    id: String(item.id ?? `ann_${randomUUID().slice(0, 8)}`),
    runId: String(item.runId ?? ""),
    status: normalizeStatus(item.status),
    label: String(item.label ?? "人工标注"),
    span: String(item.span ?? ""),
    note: String(item.note ?? ""),
    annotator: String(item.annotator ?? "legacy"),
    dimensions: normalizeDimensions(item.dimensions),
    entersImprovement: Boolean(item.entersImprovement ?? false),
    entersEval: Boolean(item.entersEval ?? false),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date().toISOString()),
  };
}

function normalizeImprovement(value: unknown): Improvement {
  const item = value as Record<string, unknown>;
  const targetType = normalizeTargetType(item.targetType ?? item.target);
  return {
    id: String(item.id ?? `imp_${randomUUID().slice(0, 8)}`),
    source: String(item.source ?? "manual"),
    sourceId: String(item.sourceId ?? ""),
    title: String(item.title ?? "运营改进建议"),
    targetType,
    targetId: String(item.targetId ?? item.target ?? targetType),
    skillId: typeof item.skillId === "string" ? item.skillId : undefined,
    status: normalizeImprovementStatus(item.status),
    clusterMethod: "规则聚类",
    sampleRunIds: Array.isArray(item.sampleRunIds) ? item.sampleRunIds.map(String) : [],
    proposal: String(item.proposal ?? ""),
    promptDraft: typeof item.promptDraft === "string" ? item.promptDraft : undefined,
    diff: typeof item.diff === "string" ? item.diff : undefined,
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : undefined,
  };
}

function normalizeAbTest(value: unknown): AbTest {
  const item = value as Record<string, unknown>;
  const rawStatus = String(item.status ?? "draft");
  return {
    id: String(item.id ?? `abt_${randomUUID().slice(0, 8)}`),
    name: String(item.name ?? "Prompt A/B"),
    status: ["draft", "running", "paused", "completed"].includes(rawStatus)
      ? (rawStatus as AbTest["status"])
      : "draft",
    variants: Array.isArray(item.variants) ? (item.variants as Array<Record<string, unknown>>) : [],
    metric: String(item.metric ?? "人工评分均值"),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
  };
}

function normalizeDimensions(value: unknown): AnnotationDimensions {
  const result = dimensionsSchema.safeParse(value ?? {});
  return result.success ? result.data : dimensionsSchema.parse({});
}

function normalizeStatus(value: unknown): AnnotationStatus {
  return value === "accepted" || value === "rejected" ? value : "pending";
}

function normalizeImprovementStatus(value: unknown): Improvement["status"] {
  return value === "todo" || value === "applied" || value === "rejected" ? value : "draft";
}

function normalizeTargetType(value: unknown): ImprovementTargetType {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("planner")) return "Planner";
  if (text.includes("tool")) return "Tool";
  if (text.includes("eval")) return "Eval";
  return "Skill";
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 3;
  return Math.min(5, Math.max(1, Math.round(score)));
}

function inferProblemType(run: RunRecord) {
  if (run.plan?.selectedTools.includes("calculate_price")) return "价格/优惠";
  if (run.plan?.selectedTools.includes("query_orders") || run.plan?.selectedTools.includes("query_logistics")) {
    return "订单/物流";
  }
  if (run.riskResult?.riskLevel === "high" || run.status === "blocked") return "风控";
  return "推荐/话术";
}

function inferImprovementTarget(
  samples: RunRecord[],
  ratings: Rating[],
  annotations: Annotation[],
): ImprovementTargetType {
  const text = [
    ...samples.map((run) => `${run.question} ${run.finalReply} ${run.error ?? ""}`),
    ...ratings.map((rating) => `${rating.problemType} ${rating.comment}`),
    ...annotations.map((annotation) => `${annotation.label} ${annotation.note}`),
  ].join(" ");

  if (/价格|优惠|券|满减|tool|Tool|calculate_price/.test(text)) return "Tool";
  if (/计划|planner|Planner|漏调|能力/.test(text)) return "Planner";
  if (/评测|eval|Eval|用例/.test(text)) return "Eval";
  return "Skill";
}

function createPromptDraft(
  currentPrompt: string,
  samples: RunRecord[],
  ratings: Rating[],
  annotations: Annotation[],
) {
  const sampleLines = samples.length
    ? samples.map((run, index) => `${index + 1}. ${run.id}：${run.question.slice(0, 80)}`).join("\n")
    : "暂无 Run 样本，先基于低分评分和标注规则生成。";
  const ratingLines = ratings.length
    ? ratings.map((rating) => `- ${rating.score}分 ${rating.problemType}：${rating.comment || rating.label}`).join("\n")
    : "- 暂无低分评分。";
  const annotationLines = annotations.length
    ? annotations.map((annotation) => `- ${annotation.label} overall=${annotation.dimensions.overall} safety=${annotation.dimensions.safety}：${annotation.note}`).join("\n")
    : "- 暂无低分标注。";
  const addition = [
    "",
    "## 运营中心规则聚类改进草案",
    "",
    "以下内容由 SnackOps 运营中心基于低评分、Bad Case 和人工标注进行规则聚类生成，不是 LLM 自动覆盖结果。应用前必须人工确认。",
    "",
    "### 样本 Run",
    sampleLines,
    "",
    "### 低分评分信号",
    ratingLines,
    "",
    "### 标注信号",
    annotationLines,
    "",
    "### 执行要求",
    "- 涉及价格、优惠、券、满减时，必须依赖 Tool 事实，不得自行编造。",
    "- 回复需覆盖正确性、相关性、完整性、安全性和语气五个维度。",
    "- 风控、售后、投诉和疑似诈骗场景必须给出安全且不推诿的回复。",
  ].join("\n");

  return `${currentPrompt.trimEnd()}\n${addition}\n`;
}

function createAppendDiff(previous: string, next: string) {
  const previousLines = previous.split(/\r?\n/);
  const nextLines = next.split(/\r?\n/);
  const added = nextLines.slice(previousLines.length);
  return ["--- current", "+++ prompt-draft", ...added.map((line) => `+${line}`)].join("\n");
}

async function createImprovementFromRating(rating: Rating, run: RunRecord) {
  const improvement: Improvement = {
    id: `imp_${Date.now()}_${randomUUID().slice(0, 8)}`,
    source: "rating",
    sourceId: rating.id,
    title: `低分 Bad Case：${rating.problemType}`,
    targetType: inferImprovementTarget([run], [rating], []),
    targetId: rating.problemType,
    status: "todo",
    clusterMethod: "规则聚类",
    sampleRunIds: [rating.runId],
    proposal: `用户评分 ${rating.score}/5。建议检查 ${rating.problemType} 场景的 Planner/Skill/Tool/Eval 配置。`,
    createdAt: new Date().toISOString(),
  };
  await updateJsonFile<unknown[]>(IMPROVEMENTS_FILE, (items) => [...items.map(normalizeImprovement), improvement], []);
}

async function createImprovementFromAnnotation(annotation: Annotation, run: RunRecord) {
  const improvement: Improvement = {
    id: `imp_${Date.now()}_${randomUUID().slice(0, 8)}`,
    source: "annotation",
    sourceId: annotation.id,
    title: `低分标注：${annotation.label}`,
    targetType: inferImprovementTarget([run], [], [annotation]),
    targetId: annotation.label,
    status: "todo",
    clusterMethod: "规则聚类",
    sampleRunIds: [annotation.runId],
    proposal: `人工标注 overall=${annotation.dimensions.overall} safety=${annotation.dimensions.safety}。建议纳入改进建议或评测集。`,
    createdAt: new Date().toISOString(),
  };
  await updateJsonFile<unknown[]>(IMPROVEMENTS_FILE, (items) => [...items.map(normalizeImprovement), improvement], []);
}

async function createEvalCaseFromAnnotation(annotation: Annotation, run: RunRecord) {
  const evalCase = {
    id: `ec_${Date.now()}_${randomUUID().slice(0, 8)}`,
    title: `标注沉淀：${annotation.label}`,
    input: run.question,
    expectedChecks: [
      "回复必须基于工具事实",
      "不得违反风控规则",
      `人工标注备注：${annotation.note || annotation.label}`,
    ],
    tags: ["annotation", annotation.label, annotation.status],
    enabled: true,
  };

  await updateJsonFile<unknown[]>(EVAL_CASES_FILE, (items) => [...items, evalCase], []);
}
