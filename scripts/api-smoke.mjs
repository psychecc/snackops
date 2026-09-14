import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const baseUrl = process.env.SNACKOPS_BASE_URL || "http://localhost:5000";
const selectedCaseIds = [
  "eval-spicy-office-budget",
  "eval-price-verification",
  "eval-prize-scam",
];

await runReset("initial");

await expectPageOk("/");

const initialConfig = await requestJson("/api/llm-config");
assert.equal(initialConfig.payload.ok, true);
assert.equal(JSON.stringify(initialConfig.payload).includes("apiKeyEnv"), false, "public config must not expose apiKeyEnv");
assert.equal(initialConfig.payload.config.resolved.provider, "classroom-fixture");

const attemptedSecretWrite = await requestJson("/api/llm-config", {
  method: "PUT",
  body: {
    provider: "classroom-fixture",
    model: "snackops-fixture-v1",
    baseUrl: "",
    apiKeyEnv: "SHOULD_NOT_BE_WRITTEN_FROM_CLIENT",
  },
});
assert.equal(attemptedSecretWrite.response.status, 200);
assert.equal(
  JSON.stringify(attemptedSecretWrite.payload).includes("SHOULD_NOT_BE_WRITTEN_FROM_CLIENT"),
  false,
  "llm config API response must not echo client-supplied apiKeyEnv",
);
const storedAfterSecretAttempt = JSON.parse(
  await fs.readFile(path.join(projectRoot, "data", "llm-config.json"), "utf8"),
);
assert.notEqual(
  storedAfterSecretAttempt.apiKeyEnv,
  "SHOULD_NOT_BE_WRITTEN_FROM_CLIENT",
  "llm config API must not persist client-supplied apiKeyEnv",
);

const skillVersionsBefore = await requestJson("/api/skills/risk-check/versions");
assert.equal(skillVersionsBefore.response.status, 200);
const beforeVersionCount = skillVersionsBefore.payload.versions.length;
const snapshot = await requestJson("/api/skills/risk-check/versions", {
  method: "POST",
  body: { changeNote: "api smoke snapshot" },
});
assert.equal(snapshot.response.status, 200);
const skillVersionsAfter = await requestJson("/api/skills/risk-check/versions");
assert.equal(skillVersionsAfter.payload.versions.length, beforeVersionCount + 1, "skill snapshot should persist");

const traversal = await requestJson("/api/skills/risk-check", {
  method: "PATCH",
  body: { filePath: "../../outside.md", changeNote: "path traversal smoke" },
});
assert.equal(traversal.response.status, 400, "path traversal skill write should be rejected");

const toolResult = await requestJson("/api/tools/calculate_price/test", {
  method: "POST",
  body: { productId: "p001", userId: "u001", quantity: 2 },
});
assert.equal(toolResult.response.status, 200);
assert.equal(toolResult.payload.ok, true);
assert.equal(typeof toolResult.payload.output.finalPrice, "number", "tool test should return real calculated finalPrice");

const created = await requestJson("/api/eval/cases", {
  method: "POST",
  body: {
    name: "API 临时用例",
    question: "帮我推荐一份低糖办公室零食。",
    expectedKeywords: ["低糖"],
    requiredCapabilities: ["query_products", "risk-check"],
    tags: ["api-smoke"],
  },
});
assert.equal(created.response.status, 200);
const tempCaseId = created.payload.case.id;

const patched = await requestJson(`/api/eval/cases/${encodeURIComponent(tempCaseId)}`, {
  method: "PATCH",
  body: {
    expectedKeywords: ["低糖", "配料"],
    keywordLogic: "AND",
    enabled: false,
  },
});
assert.equal(patched.response.status, 200);
assert.deepEqual(patched.payload.case.expectedKeywords, ["低糖", "配料"]);
assert.equal(patched.payload.case.enabled, false);

const deleted = await requestJson(`/api/eval/cases/${encodeURIComponent(tempCaseId)}`, { method: "DELETE" });
assert.equal(deleted.response.status, 200);

const emptyCaseIds = await requestJson("/api/eval/batch/run", {
  method: "POST",
  body: { caseIds: [] },
});
assert.equal(emptyCaseIds.response.status, 400, "empty caseIds should be rejected");

const invalidCaseIds = await requestJson("/api/eval/batch/run", {
  method: "POST",
  body: { caseIds: ["eval-spicy-office-budget", "missing-case-id"] },
});
assert.equal(invalidCaseIds.response.status, 400, "invalid caseIds should be rejected");
assert.equal(JSON.stringify(invalidCaseIds.payload).includes("missing-case-id"), true);

await switchProvider("openai-compatible", { baseUrl: "", model: "" });
const missingProviderTest = await requestJson("/api/llm-config/test", { method: "POST" });
if (missingProviderTest.response.status === 200) {
  throw new Error("openai-compatible without full environment unexpectedly succeeded; real provider must not silently fixture-fallback");
}
assert.equal(missingProviderTest.payload.ok, false);
assert.match(
  missingProviderTest.payload.result.error.code,
  /CONFIG_MISSING|REQUEST_FAILED|EXCEPTION/,
  "provider test should return a structured real-provider error",
);

await switchProvider("classroom-fixture", { baseUrl: "", model: "snackops-fixture-v1" });
const fixtureProviderTest = await requestJson("/api/llm-config/test", { method: "POST" });
assert.equal(fixtureProviderTest.response.status, 200);
assert.equal(fixtureProviderTest.payload.result.provider, "classroom-fixture");

const exactBatch = await createAndWaitBatch({
  name: "api-smoke-exact-3",
  versionLabel: "api-smoke",
  changeNote: "caseIds precise filter",
  caseIds: selectedCaseIds,
});
assert.equal(exactBatch.total, 3, "selected caseIds batch total should equal 3");
assert.deepEqual(exactBatch.caseIds, selectedCaseIds);
assert.deepEqual(
  exactBatch.caseResults.map((result) => result.caseId),
  selectedCaseIds,
  "batch results should contain only requested caseIds",
);
assertBatchCounts(exactBatch);
assert.equal(exactBatch.status, "done");
for (const result of exactBatch.caseResults) {
  assert.equal(typeof result.finalReply, "string");
  assert.equal(Boolean(result.runId), true, "case result should include runId evidence");
  assert.equal(Array.isArray(result.trace.steps), true, "case result should include trace steps");
  assert.equal(typeof result.score.reason, "string");
}

const baseline = await createAndWaitBatch({
  name: "baseline-v1",
  versionLabel: "baseline-v1",
  changeNote: "API smoke baseline",
  caseIds: selectedCaseIds,
});
const regression = await createAndWaitBatch({
  name: "risk-fix-v2",
  versionLabel: "risk-fix-v2",
  changeNote: "API smoke comparison",
  regressionFromBatchId: baseline.id,
});
assert.deepEqual(regression.caseIds, baseline.caseIds, "regression batch should reuse baseline caseIds");

const comparison = await requestJson("/api/eval/batch/compare", {
  method: "POST",
  body: { leftBatchId: baseline.id, rightBatchId: regression.id },
});
assert.equal(comparison.response.status, 200);
assert.equal(comparison.payload.comparison.consistency.caseIds, true);
assert.equal(comparison.payload.comparison.consistency.evaluator, true);
assert.equal(Array.isArray(comparison.payload.comparison.fixedCases), true);
assert.equal(Array.isArray(comparison.payload.comparison.newFailures), true);

await runReset("final");
const afterReset = await requestJson("/api/eval");
assert.equal(afterReset.response.status, 200);
assert.equal(afterReset.payload.cases.length, 9, "classroom reset should restore seeded eval cases");
assert.equal(afterReset.payload.batches.length, 0, "classroom reset should clear eval batches");
const resetConfig = await requestJson("/api/llm-config");
assert.equal(resetConfig.payload.config.resolved.provider, "classroom-fixture");

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      exactBatchId: exactBatch.id,
      baselineBatchId: baseline.id,
      regressionBatchId: regression.id,
      selectedCaseIds,
      providerMissingStatus: missingProviderTest.response.status,
      resetCases: afterReset.payload.cases.length,
    },
    null,
    2,
  ),
);

async function requestJson(route, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const init = { ...options, headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${route}`, init);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return { response, payload, text };
}

async function expectPageOk(route) {
  const response = await fetch(`${baseUrl}${route}`);
  assert.equal(response.status, 200, `${route} should return 200`);
}

async function switchProvider(provider, patch = {}) {
  const switched = await requestJson("/api/llm-config/switch", {
    method: "POST",
    body: { provider, ...patch },
  });
  assert.equal(switched.response.status, 200);
  assert.equal(switched.payload.config.stored.provider, provider);
  return switched.payload.config;
}

async function createAndWaitBatch(body) {
  const created = await requestJson("/api/eval/batch/run", {
    method: "POST",
    body,
  });
  assert.equal(created.response.status, 200);
  const batchId = created.payload.batchId;
  assert.equal(Boolean(batchId), true);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(500);
    const current = await requestJson(`/api/eval/batch/${encodeURIComponent(batchId)}`);
    assert.equal(current.response.status, 200);
    const batch = current.payload.batch;
    if (["done", "error", "cancelled"].includes(batch.status)) {
      if (batch.status !== "done") {
        throw new Error(`Batch ${batchId} ended as ${batch.status}: ${batch.error}`);
      }
      return batch;
    }
  }

  throw new Error(`Timed out waiting for batch ${batchId}`);
}

function assertBatchCounts(batch) {
  const counts = batch.caseResults.reduce(
    (current, result) => {
      current.total += 1;
      if (result.status === "PASS") current.passed += 1;
      if (result.status === "FAIL") current.failed += 1;
      if (result.status === "REVIEW") current.review += 1;
      if (result.status === "ERROR") current.error += 1;
      return current;
    },
    { total: 0, passed: 0, failed: 0, review: 0, error: 0 },
  );
  assert.equal(batch.total, counts.total);
  assert.equal(batch.passed, counts.passed);
  assert.equal(batch.failed, counts.failed);
  assert.equal(batch.review, counts.review);
  assert.equal(batch.errors, counts.error);
  assert.equal(counts.total, counts.passed + counts.failed + counts.review + counts.error);
}

async function runReset(label) {
  const result = spawnSync(process.execPath, [path.join("scripts", "classroom-reset.mjs")], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "development" },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`classroom reset ${label} failed: ${result.stderr || result.stdout}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
