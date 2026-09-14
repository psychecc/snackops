import type { RunRecord, SkillVersion } from "@/lib/types";

export type Rating = {
  id: string;
  runId: string;
  score: number;
  label: string;
  comment: string;
  question: string;
  answer: string;
  problemType: string;
  createdAt: string;
};

export type AnnotationStatus = "pending" | "accepted" | "rejected";

export type AnnotationDimensions = {
  correctness: number;
  relevance: number;
  completeness: number;
  safety: number;
  tone: number;
  overall: number;
};

export type Annotation = {
  id: string;
  runId: string;
  status: AnnotationStatus;
  label: string;
  span: string;
  note: string;
  annotator: string;
  dimensions: AnnotationDimensions;
  entersImprovement: boolean;
  entersEval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ImprovementTargetType = "Planner" | "Skill" | "Tool" | "Eval";
export type ImprovementStatus = "draft" | "todo" | "applied" | "rejected";

export type Improvement = {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  targetType: ImprovementTargetType;
  targetId: string;
  skillId?: string;
  status: ImprovementStatus;
  clusterMethod: "规则聚类";
  sampleRunIds: string[];
  proposal: string;
  promptDraft?: string;
  diff?: string;
  createdAt: string;
  appliedAt?: string;
};

export type AbTest = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  variants: Array<Record<string, unknown>>;
  metric: string;
  createdAt: string;
};

export type OpsDashboard = {
  metrics: {
    totalRuns: number;
    successRate: number;
    averageDurationMs: number;
    handoffRate: number;
    failedSteps: Array<{ capabilityId: string; count: number }>;
    riskDistribution: Array<{ riskLevel: string; count: number }>;
  };
  recentRuns: RunRecord[];
  ratings: Rating[];
  annotations: Annotation[];
  improvements: Improvement[];
  abTests: AbTest[];
  rollbackVersions: SkillVersion[];
};
