import { callLlm, resolveLlmConfig, type LlmProviderName } from "@/lib/llm-provider";
import { readJsonFile, writeJsonFile } from "@/lib/store";

export type StoredLlmConfig = {
  provider: LlmProviderName;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  timeoutMs: number;
  jsonMode: boolean;
  notes?: string;
};

export type PublicStoredLlmConfig = Omit<StoredLlmConfig, "apiKeyEnv">;
export type StoredLlmConfigPatch = Partial<Omit<StoredLlmConfig, "apiKeyEnv">>;

const LLM_CONFIG_FILE = "llm-config.json";
const LLM_PROVIDER_NAMES = ["coze", "openai-compatible", "classroom-fixture"] as const;

export function isLlmProviderName(value: unknown): value is LlmProviderName {
  return typeof value === "string" && LLM_PROVIDER_NAMES.includes(value as LlmProviderName);
}

export async function getStoredLlmConfig() {
  const config = await readJsonFile<StoredLlmConfig>(LLM_CONFIG_FILE, {
    provider: "classroom-fixture",
    baseUrl: "",
    model: "snackops-fixture-v1",
    apiKeyEnv: "",
    timeoutMs: 12000,
    jsonMode: true,
  });

  if (!isLlmProviderName(config.provider)) {
    throw new Error(`未知 Provider：${String(config.provider)}`);
  }

  return config;
}

export async function saveStoredLlmConfig(patch: StoredLlmConfigPatch) {
  const current = await getStoredLlmConfig();
  const provider = patch.provider ?? current.provider;

  if (!isLlmProviderName(provider)) {
    throw new Error(`未知 Provider：${String(provider)}`);
  }

  const next: StoredLlmConfig = {
    ...current,
    ...patch,
    apiKeyEnv: current.apiKeyEnv ?? "",
    provider,
  };
  await writeJsonFile(LLM_CONFIG_FILE, next);
  return next;
}

export async function getPublicLlmConfig() {
  const [stored, resolved] = await Promise.all([getStoredLlmConfig(), resolveLlmConfig()]);
  const envStatus = {
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    OPENAI_BASE_URL: Boolean(process.env.OPENAI_BASE_URL),
    LLM_MODEL: Boolean(process.env.LLM_MODEL),
    COZE_API_TOKEN: Boolean(process.env.COZE_API_TOKEN),
    COZE_BOT_ID: Boolean(process.env.COZE_BOT_ID),
  };
  const configurationStatus = getProviderConfigurationStatus(
    resolved.provider,
    { baseUrl: resolved.baseUrl, model: resolved.model },
    envStatus,
  );

  return {
    stored: toPublicStoredConfig(stored),
    resolved,
    lockedByEnv: Boolean(process.env.LLM_PROVIDER),
    providers: [
      {
        id: "classroom-fixture",
        name: "课堂演示稳定模式",
        description: "无外部密钥，本地确定性输出，仍经过 Planner、Executor、Tool、risk-check 全链路。",
      },
      {
        id: "openai-compatible",
        name: "OpenAI Compatible",
        description: "通过 OPENAI_API_KEY、OPENAI_BASE_URL、LLM_MODEL 调用兼容 Chat Completions 的模型。",
      },
      {
        id: "coze",
        name: "Coze",
        description: "通过 coze-coding-dev-sdk 和 COZE_API_TOKEN、COZE_BOT_ID 调用。",
      },
    ],
    models: ["snackops-fixture-v1", "deepseek-chat", "gpt-4.1-mini", "coze-default"],
    envStatus,
    configurationStatus,
  };
}

export async function testLlmConfig() {
  const response = await callLlm({
    task: "provider-test",
    systemPrompt: "返回 JSON：{ ok:true, message:string }",
    userPayload: { ping: true },
    expectJson: true,
    timeoutMs: 5000,
  });

  return response;
}

function toPublicStoredConfig(config: StoredLlmConfig): PublicStoredLlmConfig {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: config.timeoutMs,
    jsonMode: config.jsonMode,
    notes: config.notes,
  };
}

function getProviderConfigurationStatus(
  provider: LlmProviderName,
  resolved: Pick<StoredLlmConfig, "baseUrl" | "model">,
  envStatus: Record<string, boolean>,
) {
  if (provider === "classroom-fixture") {
    return {
      provider,
      ready: true,
      mode: "演示稳定模式",
      required: [],
      missing: [],
      message: "classroom-fixture 是本地确定性演示模式，不需要外部密钥，也不会伪装成真实模型。",
    };
  }

  if (provider === "openai-compatible") {
    const missing = [
      envStatus.OPENAI_API_KEY ? "" : "OPENAI_API_KEY",
      envStatus.OPENAI_BASE_URL || resolved.baseUrl ? "" : "OPENAI_BASE_URL",
      envStatus.LLM_MODEL || resolved.model ? "" : "LLM_MODEL",
    ].filter(Boolean);

    return {
      provider,
      ready: missing.length === 0,
      mode: "真实 Provider",
      required: ["OPENAI_API_KEY", "OPENAI_BASE_URL", "LLM_MODEL"],
      missing,
      message: missing.length === 0
        ? "openai-compatible 配置完整，后续 RunRecord 会记录该 Provider 和模型。"
        : `openai-compatible 缺少配置：${missing.join(", ")}。请补齐环境变量，或切回 classroom-fixture 演示模式。`,
    };
  }

  const missing = [
    envStatus.COZE_API_TOKEN ? "" : "COZE_API_TOKEN",
    envStatus.COZE_BOT_ID ? "" : "COZE_BOT_ID",
  ].filter(Boolean);

  return {
    provider,
    ready: missing.length === 0,
    mode: "真实 Provider",
    required: ["COZE_API_TOKEN", "COZE_BOT_ID"],
    missing,
    message: missing.length === 0
      ? "coze 配置完整，后续 RunRecord 会记录该 Provider 和模型。"
      : `coze 缺少配置：${missing.join(", ")}。请补齐环境变量，或切回 classroom-fixture 演示模式。`,
  };
}
