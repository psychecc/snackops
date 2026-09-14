import { z } from "zod";

export const moneySchema = z.number().nonnegative();

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  categoryName: z.string(),
  price: moneySchema,
  stock: z.number().int().nonnegative(),
  spec: z.string(),
  flavors: z.array(z.string()),
  tags: z.array(z.string()),
  ingredients: z.array(z.string()).default([]),
  allergens: z.array(z.string()),
  nutrition: z
    .object({
      sugarLevel: z.string(),
      sugarGramPer100g: z.number().nonnegative(),
      caloriesKcalPer100g: z.number().nonnegative(),
      proteinGramPer100g: z.number().nonnegative(),
      fatGramPer100g: z.number().nonnegative(),
      sodiumMgPer100g: z.number().nonnegative(),
    })
    .optional(),
  description: z.string(),
  salesRank: z.number().int().positive(),
});

export const promotionSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  scope: z.enum(["all", "category", "product", "tag"]),
  type: z.string().optional(),
  categories: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  minSpend: moneySchema,
  discountAmount: moneySchema,
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  rule: z.string().optional(),
  description: z.string(),
});

export const couponSchema = promotionSchema.extend({
  couponType: z.enum(["new_customer", "category", "product", "shipping", "general"]).optional(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
  isNewCustomer: z.boolean().optional(),
  historicalOrderIds: z.array(z.string()).optional(),
  preferences: z
    .object({
      flavors: z.array(z.string()).default([]),
      categories: z.array(z.string()).default([]),
      avoidAllergens: z.array(z.string()).default([]),
      budgetRange: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()),
  city: z.string(),
  riskNotes: z.array(z.string()),
});

export const orderSchema = z.object({
  id: z.string(),
  orderNo: z.string().optional(),
  userId: z.string(),
  status: z.string(),
  totalAmount: moneySchema,
  logisticsStatus: z.string().optional(),
  afterSalesStatus: z.string().optional(),
  trackingNo: z.string().optional(),
  carrier: z.string().optional(),
  shippingRegion: z.string().optional(),
  createdAt: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      paidAmount: moneySchema,
    }),
  ),
});

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  requiredTools: z.array(z.string()).default([]),
  version: z.string(),
  filePath: z.string(),
  prompt: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  owner: z.string(),
  implementation: z.string().optional(),
  testEndpoint: z.string().optional(),
  testInput: z.record(z.unknown()).optional(),
});

export const skillVersionSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  version: z.string(),
  createdAt: z.string(),
  changeNote: z.string(),
  hash: z.string(),
  filePath: z.string(),
  metadata: skillSchema.omit({ systemPrompt: true, prompt: true }),
  systemPrompt: z.string(),
});

export const runSchema = z.object({
  id: z.string(),
  channel: z.string(),
  userInput: z.string(),
  status: z.enum(["success", "failed", "blocked", "draft"]),
  plannerVersion: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  stepCount: z.number().int().nonnegative(),
  riskLevel: z.enum(["low", "medium", "high", "unknown"]),
});

export const executionStepSchema = z.object({
  stepId: z.string(),
  type: z.enum(["skill", "tool", "planner", "validator", "risk"]),
  capabilityId: z.string(),
  capabilityName: z.string(),
  input: z.unknown(),
  output: z.unknown().optional(),
  durationMs: z.number().nonnegative(),
  status: z.enum(["success", "error", "skipped", "blocked"]),
  error: z.string().nullable(),
});

export const agentPlanSchema = z.object({
  id: z.string(),
  selectedSkills: z.array(z.string()),
  selectedTools: z.array(z.string()),
  reasoning: z.array(z.string()),
  mandatoryCapabilities: z.array(z.string()),
  riskJudgement: z.object({
    level: z.enum(["low", "medium", "high"]),
    reasons: z.array(z.string()),
    needsHandoff: z.boolean(),
  }),
  steps: z.array(
    z.object({
      stepId: z.string(),
      type: z.enum(["skill", "tool"]),
      capabilityId: z.string(),
      purpose: z.string(),
    }),
  ),
  fallback: z
    .object({
      used: z.boolean(),
      reason: z.string(),
    })
    .optional(),
});

export const riskResultSchema = z.object({
  passed: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  issues: z.array(z.string()),
  safeReply: z.string(),
  blockedReason: z.string().nullable(),
});

export const runRecordSchema = z.object({
  id: z.string(),
  question: z.string(),
  source: z.string(),
  conversationId: z.string(),
  createdAt: z.string(),
  status: z.enum(["success", "failed", "blocked", "handoff"]),
  finalReply: z.string(),
  plan: agentPlanSchema.nullable(),
  steps: z.array(executionStepSchema),
  riskResult: riskResultSchema.nullable(),
  durationMs: z.number().nonnegative(),
  error: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  skillVersions: z.record(z.string()),
  toolVersions: z.record(z.string()),
});

export const evalCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  input: z.string(),
  expectedChecks: z.array(z.string()),
  tags: z.array(z.string()),
  enabled: z.boolean(),
});

export type Product = z.infer<typeof productSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
export type Coupon = z.infer<typeof couponSchema>;
export type User = z.infer<typeof userSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type SkillVersion = z.infer<typeof skillVersionSchema>;
export type Run = z.infer<typeof runSchema>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type RiskResult = z.infer<typeof riskResultSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;

export type Ticket = {
  id: string;
  userId: string;
  title: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "medium" | "high";
  createdAt: string;
  lastMessage: string;
};

export type LlmConfig = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  timeoutMs: number;
  jsonMode: boolean;
};

export type ToolRunResult = {
  ok: boolean;
  toolId: string;
  input: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  executedAt: string;
};

export type CatalogSummary = {
  id: string;
  label: string;
  file: string;
  count: number;
  fields: string[];
  sample: unknown[];
};
