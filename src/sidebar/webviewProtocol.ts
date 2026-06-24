import { AgentAction, AgentActionResult } from "../core/agent/AgentTypes";

export type PublicSettings = {
  selectedModel: string;
  hasOpenAIKey: boolean;
  hasZaiKey: boolean;
  requireCommandApproval: boolean;
  requireFileEditApproval: boolean;
};

export type WebviewToExtensionMessage =
  | { type: "submitPrompt"; prompt: string; modelId: string }
  | { type: "saveApiKey"; provider: "openai" | "zai"; apiKey: string }
  | { type: "deleteApiKey"; provider: "openai" | "zai" }
  | { type: "getSettings" }
  | { type: "clearChat" }
  | { type: "approveAction"; actionId: string }
  | { type: "rejectAction"; actionId: string }
  | { type: "cancelExecution" }
  | { type: "updateApprovalSettings"; requireCommandApproval: boolean; requireFileEditApproval: boolean };

export type ExtensionToWebviewMessage =
  | { type: "settingsLoaded"; settings: PublicSettings }
  | { type: "assistantDelta"; text: string }
  | { type: "assistantMessage"; text: string }
  | { type: "actionPreview"; action: AgentAction }
  | { type: "actionResult"; result: AgentActionResult }
  | { type: "commandOutput"; text: string }
  | { type: "error"; message: string }
  | { type: "loopFinished" };
