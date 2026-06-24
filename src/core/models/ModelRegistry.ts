import { SecretManager } from "../settings/SecretManager";
import { ModelAdapter } from "./ModelAdapter";
import { OpenAIResponsesAdapter } from "./OpenAIResponsesAdapter";
import { ZaiGlmAdapter } from "./ZaiGlmAdapter";

export type ModelProvider = "openai" | "zai";

export type ModelConfig = {
  internalId: string;
  label: string;
  provider: ModelProvider;
  apiModel: string;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
};

export const MODELS: ModelConfig[] = [
  {
    internalId: "openai-gpt-5-4-codex",
    label: "GPT-5.4 Codex",
    provider: "openai",
    apiModel: "gpt-5.4",
    supportsStreaming: true,
    supportsToolCalling: true
  },
  {
    internalId: "zai-glm-4-7",
    label: "GLM-4.7",
    provider: "zai",
    apiModel: "glm-4.7",
    supportsStreaming: true,
    supportsToolCalling: true
  }
];

export class ModelRegistry {
  constructor(private secretManager: SecretManager) {}

  getModels(): ModelConfig[] {
    return MODELS;
  }

  getModelConfig(internalId: string): ModelConfig | undefined {
    return MODELS.find(m => m.internalId === internalId);
  }

  async getAdapter(internalId: string): Promise<ModelAdapter> {
    const config = this.getModelConfig(internalId);
    if (!config) {
      throw new Error(`Unknown model ID: ${internalId}`);
    }

    const apiKey = await this.secretManager.getApiKey(config.provider);
    if (!apiKey) {
      throw new Error(`API key for provider '${config.provider}' is missing. Please set it in the settings panel.`);
    }

    if (config.provider === "openai") {
      return new OpenAIResponsesAdapter(config, apiKey);
    } else if (config.provider === "zai") {
      return new ZaiGlmAdapter(config, apiKey);
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
