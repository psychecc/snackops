import { randomUUID } from "node:crypto";
import { readJsonFile, updateJsonFile } from "@/lib/store";
import { runRecordSchema, type RunRecord } from "@/lib/types";

const RUNS_FILE = "runs.json";

export async function listRunRecords(limit = 20, page = 1) {
  const raw = await readJsonFile<unknown[]>(RUNS_FILE, []);
  const normalized = raw.map(normalizeRunRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = Math.max(0, page - 1) * limit;
  return {
    total: normalized.length,
    page,
    limit,
    runs: normalized.slice(start, start + limit),
  };
}

export async function getRunRecord(id: string) {
  const raw = await readJsonFile<unknown[]>(RUNS_FILE, []);
  const found = raw.map(normalizeRunRecord).find((run) => run.id === id);
  return found ?? null;
}

export async function saveRunRecord(record: RunRecord) {
  const parsed = runRecordSchema.parse(record);
  await updateJsonFile<unknown[]>(
    RUNS_FILE,
    (runs) => [...runs, parsed],
    [],
  );
  return parsed;
}

export async function updateRunRecord(id: string, patch: Partial<RunRecord>) {
  let updated: RunRecord | null = null;
  await updateJsonFile<unknown[]>(
    RUNS_FILE,
    (runs) =>
      runs.map((run) => {
        const normalized = normalizeRunRecord(run);
        if (normalized.id !== id) {
          return run;
        }
        updated = runRecordSchema.parse({ ...normalized, ...patch });
        return updated;
      }),
    [],
  );
  return updated;
}

export function createRunId() {
  return `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function normalizeRunRecord(value: unknown): RunRecord {
  const result = runRecordSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const legacy = value as Record<string, unknown>;
  const startedAt = String(legacy.startedAt ?? legacy.createdAt ?? new Date().toISOString());
  return runRecordSchema.parse({
    id: String(legacy.id ?? createRunId()),
    question: String(legacy.question ?? legacy.userInput ?? ""),
    source: String(legacy.source ?? legacy.channel ?? "legacy"),
    conversationId: String(legacy.conversationId ?? "legacy"),
    createdAt: startedAt,
    status: legacy.status === "blocked" ? "blocked" : legacy.status === "failed" ? "failed" : "success",
    finalReply: String(legacy.finalReply ?? ""),
    plan: null,
    steps: [],
    riskResult: legacy.riskLevel
      ? {
          passed: legacy.riskLevel !== "high",
          riskLevel: legacy.riskLevel,
          issues: [],
          safeReply: "",
          blockedReason: legacy.riskLevel === "high" ? "旧记录风险较高" : null,
        }
      : null,
    durationMs: 0,
    error: null,
    provider: "legacy",
    model: "legacy",
    skillVersions: {},
    toolVersions: {},
  });
}
