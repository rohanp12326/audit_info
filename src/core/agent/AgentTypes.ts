export type ReadFileAction = {
  id: string;
  type: "read_file";
  path: string;
};

export type WriteFileAction = {
  id: string;
  type: "write_file";
  path: string;
  summary: string;
  content: string;
};

export type PatchFileAction = {
  id: string;
  type: "patch_file";
  path: string;
  summary: string;
  unifiedDiff: string;
};

export type CreateFileAction = {
  id: string;
  type: "create_file";
  path: string;
  summary: string;
  content?: string;
};

export type DeleteFileAction = {
  id: string;
  type: "delete_file";
  path: string;
  summary: string;
};

export type RunCommandAction = {
  id: string;
  type: "run_command";
  command: string;
  cwd?: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
};

export type AgentAction =
  | ReadFileAction
  | WriteFileAction
  | PatchFileAction
  | CreateFileAction
  | DeleteFileAction
  | RunCommandAction;

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type WorkspaceFile = {
  path: string;
  sizeBytes?: number;
  content?: string;
};

export type WorkspaceContext = {
  rootPath: string;
  activeFile?: {
    path: string;
    languageId: string;
    content: string;
    selection?: string;
  };
  openFiles: WorkspaceFile[];
  relevantFiles: WorkspaceFile[];
  fileTree: string[];
  gitDiff?: string;
};

export type AgentModelInput = {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  workspaceContext: WorkspaceContext;
  conversation: ChatMessage[];
};

export type ModelStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "action"; action: AgentAction }
  | { type: "done"; parsedResponse?: AgentResponse }
  | { type: "error"; error: string };

export type AgentResponse = {
  assistantMessage: string;
  actions: AgentAction[];
  nextStep: "done" | "continue" | "await_user";
};

export type AgentActionResult = {
  actionId: string;
  type: AgentAction["type"];
  success: boolean;
  output?: string;
  error?: string;
};

export const AgentResponseSchema = {
  type: "object",
  required: ["assistantMessage", "actions", "nextStep"],
  properties: {
    assistantMessage: {
      type: "string"
    },
    nextStep: {
      type: "string",
      enum: ["done", "continue", "await_user"]
    },
    actions: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            required: ["type", "path"],
            properties: {
              type: { const: "read_file" },
              path: { type: "string" }
            }
          },
          {
            type: "object",
            required: ["type", "path", "content", "summary"],
            properties: {
              type: { const: "write_file" },
              path: { type: "string" },
              content: { type: "string" },
              summary: { type: "string" }
            }
          },
          {
            type: "object",
            required: ["type", "path", "unifiedDiff", "summary"],
            properties: {
              type: { const: "patch_file" },
              path: { type: "string" },
              unifiedDiff: { type: "string" },
              summary: { type: "string" }
            }
          },
          {
            type: "object",
            required: ["type", "command", "summary", "riskLevel"],
            properties: {
              type: { const: "run_command" },
              command: { type: "string" },
              cwd: { type: "string" },
              summary: { type: "string" },
              riskLevel: {
                type: "string",
                enum: ["low", "medium", "high"]
              }
            }
          }
        ]
      }
    }
  }
};

