import { readJsonFile } from "@/lib/store";

export type LlmProviderName = "coze" | "openai-compatible" | "classroom-fixture";

export type LlmRequest = {
  task: string;
  systemPrompt: string;
  userPayload: unknown;
  expectJson?: boolean;
  timeoutMs?: number;
};

export type LlmResponse = {
  ok: boolean;
  provider: LlmProviderName;
  model: string;
  content: string;
  json?: unknown;
  error?: {
    code: string;
    message: string;
    switchToDemoHint: string;
  };
  report: {
    generation: string;
    executionScore: number;
    notes: string[];
  };
};

type LlmConfig = {
  provider?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
};

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const config = await resolveLlmConfig();

  if (config.provider === "classroom-fixture") {
    return createFixtureResponse(request, config.model);
  }

  if (config.provider === "openai-compatible") {
    return callOpenAiCompatible(request, config);
  }

  if (config.provider === "coze") {
    return callCoze(request, config);
  }

  return createProviderError(
    config.provider,
    config.model,
    "UNKNOWN_PROVIDER",
    `未知 LLM_PROVIDER：${config.provider}`,
  );
}

export async function resolveLlmConfig() {
  const fileConfig = await readJsonFile<LlmConfig>("llm-config.json", {});
  const provider = (process.env.LLM_PROVIDER || fileConfig.provider || "classroom-fixture") as LlmProviderName;
  const model = process.env.LLM_MODEL || fileConfig.model || "snackops-fixture-v1";

  return {
    provider,
    model,
    baseUrl: process.env.OPENAI_BASE_URL || fileConfig.baseUrl || "",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || fileConfig.timeoutMs || 12000),
  };
}

async function callOpenAiCompatible(request: LlmRequest, config: Awaited<ReturnType<typeof resolveLlmConfig>>) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !config.baseUrl || !config.model) {
    return createProviderError(
      "openai-compatible",
      config.model,
      "OPENAI_COMPATIBLE_CONFIG_MISSING",
      "openai-compatible 模式缺少 OPENAI_API_KEY、OPENAI_BASE_URL 或 LLM_MODEL。请补齐环境变量，或设置 LLM_PROVIDER=classroom-fixture 切换到课堂演示模式。",
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? config.timeoutMs);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: request.expectJson ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: JSON.stringify(request.userPayload) },
        ],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content ?? "";

    if (!response.ok) {
      return createProviderError(
        "openai-compatible",
        config.model,
        "OPENAI_COMPATIBLE_REQUEST_FAILED",
        `openai-compatible 调用失败：${payload?.error?.message ?? response.statusText}`,
      );
    }

    return createSuccess("openai-compatible", config.model, content, request.expectJson);
  } catch (error) {
    return createProviderError(
      "openai-compatible",
      config.model,
      "OPENAI_COMPATIBLE_EXCEPTION",
      `openai-compatible 调用异常：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function callCoze(request: LlmRequest, config: Awaited<ReturnType<typeof resolveLlmConfig>>) {
  if (!process.env.COZE_API_TOKEN || !process.env.COZE_BOT_ID) {
    return createProviderError(
      "coze",
      config.model,
      "COZE_CONFIG_MISSING",
      "coze 模式缺少 COZE_API_TOKEN 或 COZE_BOT_ID。请补齐 Coze 环境变量，或设置 LLM_PROVIDER=classroom-fixture 切换到课堂演示模式。",
    );
  }

  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<Record<string, unknown>>;
    const sdk = await dynamicImport("coze-coding-dev-sdk");
    const run = sdk.run || sdk.default;

    if (typeof run !== "function") {
      return createProviderError(
        "coze",
        config.model,
        "COZE_SDK_UNSUPPORTED",
        "已找到 coze-coding-dev-sdk，但没有识别到可调用入口。请检查 SDK 版本，或设置 LLM_PROVIDER=classroom-fixture 切换到课堂演示模式。",
      );
    }

    const content = String(
      await run({
        apiToken: process.env.COZE_API_TOKEN,
        botId: process.env.COZE_BOT_ID,
        prompt: request.systemPrompt,
        input: request.userPayload,
      }),
    );

    return createSuccess("coze", config.model || "coze", content, request.expectJson);
  } catch (error) {
    return createProviderError(
      "coze",
      config.model,
      "COZE_REQUEST_FAILED",
      `coze 调用失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function createFixtureResponse(request: LlmRequest, model: string): LlmResponse {
  const generated = createFixtureGeneration(request);
  const content = request.expectJson ? JSON.stringify(generated) : String(generated.reply ?? generated.summary ?? "");

  return {
    ok: true,
    provider: "classroom-fixture",
    model,
    content,
    json: generated,
    report: {
      generation: "classroom-fixture 生成了确定性演示输出。",
      executionScore: 1,
      notes: ["该输出仍会经过 Planner、Executor、Tool 和 risk-check 链路。"],
    },
  };
}

function createFixtureGeneration(request: LlmRequest) {
  const text = JSON.stringify(request.userPayload).toLowerCase();

  if (request.task === "planner") {
    return { fixture: true, task: request.task, text };
  }

  if (request.task === "risk-check") {
    const highRisk = /中奖|转账|验证码|银行卡|保证金|保证|不胖|治疗|退款/.test(text);
    return {
      passed: !highRisk,
      riskLevel: highRisk ? "high" : "low",
      issues: highRisk ? ["检测到高风险承诺或诈骗/售后敏感词"] : [],
      safeReply: "",
      blockedReason: highRisk ? "需要安全改写或人工接管" : null,
    };
  }

  return {
    summary: "课堂 fixture 输出",
    reply: "已根据当前工具结果生成演示回复。",
  };
}

function createSuccess(provider: LlmProviderName, model: string, content: string, expectJson?: boolean): LlmResponse {
  let json: unknown;

  if (expectJson) {
    try {
      json = JSON.parse(content);
    } catch {
      json = undefined;
    }
  }

  return {
    ok: true,
    provider,
    model,
    content,
    json,
    report: {
      generation: `${provider} 已生成内容。`,
      executionScore: json || !expectJson ? 1 : 0,
      notes: json || !expectJson ? [] : ["模型输出不是合法 JSON，调用方需要 fallback。"],
    },
  };
}

function createProviderError(
  provider: string,
  model: string,
  code: string,
  message: string,
): LlmResponse {
  return {
    ok: false,
    provider: provider as LlmProviderName,
    model,
    content: "",
    error: {
      code,
      message,
      switchToDemoHint: "本地验收可设置 LLM_PROVIDER=classroom-fixture，或保持 data/llm-config.json provider 为 classroom-fixture。",
    },
    report: {
      generation: "未生成",
      executionScore: 0,
      notes: [message],
    },
  };
}
