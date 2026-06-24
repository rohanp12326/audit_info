import * as vscode from "vscode";

const OPENAI_API_KEY = "vibeCoder.openaiApiKey";
const ZAI_API_KEY = "vibeCoder.zaiApiKey";

export class SecretManager {
  constructor(private context: vscode.ExtensionContext) {}

  private getSecretKey(provider: "openai" | "zai"): string {
    return provider === "openai" ? OPENAI_API_KEY : ZAI_API_KEY;
  }

  async saveApiKey(provider: "openai" | "zai", value: string): Promise<void> {
    const key = this.getSecretKey(provider);
    await this.context.secrets.store(key, value);
  }

  async getApiKey(provider: "openai" | "zai"): Promise<string | undefined> {
    const key = this.getSecretKey(provider);
    return await this.context.secrets.get(key);
  }

  async deleteApiKey(provider: "openai" | "zai"): Promise<void> {
    const key = this.getSecretKey(provider);
    await this.context.secrets.delete(key);
  }

  async hasApiKey(provider: "openai" | "zai"): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return typeof key === "string" && key.length > 0;
  }
}
