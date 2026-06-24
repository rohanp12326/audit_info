Below is a practical **LLD document** you can directly pass to Codex/Cursor/Claude Code to start building the VS Code extension.

One correction: keep `gpt-5.4-codex` as a **UI label only** unless your API provider confirms that exact model ID. OpenAI currently documents `gpt-5.4` as Codex-capable and `gpt-5-codex` as an agentic coding model; the LLD therefore keeps display names separate from actual API model IDs. ([OpenAI Developers][1])

---

# LLD: Vibe Coding VS Code Extension

## 1. Project Overview

### Project Name

**Vibe Coder VS Code Extension**

### Goal

Build a VS Code sidebar extension similar to Claude Code/Codex where the user can:

1. Enter coding prompts.
2. Select model between:

   * `GPT-5.4 Codex` UI label
   * `GLM-4.7`
3. Save API keys locally.
4. Let the AI inspect workspace files.
5. Let the AI modify code files.
6. Let the AI execute terminal commands.
7. Run everything inside the VS Code extension without a custom backend server.

VS Code supports custom sidebar/panel views through `viewsContainers`, `views`, and `registerWebviewViewProvider`, so the extension should use a **Webview View** inside a custom Activity Bar container. ([Visual Studio Code][2])

---

## 2. Scope

### In Scope

* VS Code sidebar UI.
* Prompt input box.
* Chat-style conversation panel.
* Model selector.
* Settings section for API keys.
* Local key storage using VS Code SecretStorage.
* Workspace file reading.
* Code modification using VS Code APIs.
* File creation/deletion/patching.
* Terminal command execution.
* Command approval flow.
* Streaming AI responses.
* Agent-style loop: think → inspect files → propose changes → apply changes → run command → summarize.

### Out of Scope

* No backend server.
* No user authentication system.
* No cloud project storage.
* No team collaboration.
* No web dashboard.
* No remote container sandbox in v1.
* No marketplace billing in v1.

---

## 3. Technology Stack

| Layer             | Technology                                  |
| ----------------- | ------------------------------------------- |
| Extension Runtime | TypeScript + VS Code Extension API          |
| UI                | Webview View with HTML/CSS/JS or React/Vite |
| Storage           | VS Code SecretStorage + globalState         |
| OpenAI Model API  | OpenAI Responses API                        |
| GLM API           | Z.AI Chat Completions API                   |
| File Edits        | `vscode.WorkspaceEdit`, `workspace.fs`      |
| Terminal          | `vscode.window.createTerminal()`            |
| Packaging         | `vsce`                                      |
| Testing           | Mocha/Jest + VS Code Extension Test Runner  |

API keys should be stored using `ExtensionContext.secrets`, because VS Code’s `SecretStorage` is designed for sensitive values and stores them encrypted using platform-specific storage. ([Visual Studio Code][3])

---

## 4. High-Level Runtime Architecture

```text
User
 |
 | prompt / settings / model select
 v
VS Code Sidebar Webview
 |
 | postMessage()
 v
Extension Host
 |
 |-----------------------------|
 | AgentOrchestrator           |
 | ModelAdapter                |
 | WorkspaceContextService     |
 | PatchService                |
 | CommandExecutionService     |
 | SecretManager               |
 |-----------------------------|
 |
 | direct HTTPS API call
 v
OpenAI / Z.AI API
 |
 | response / tool actions
 v
Extension Host
 |
 | apply edits / run commands
 v
VS Code Workspace + Terminal
```

No backend is needed. The extension host directly calls the selected model API using the locally stored user API key.

---

## 5. VS Code Extension Contribution Design

### `package.json` Contribution Points

```json
{
  "name": "vibe-coder",
  "displayName": "Vibe Coder",
  "description": "AI coding agent inside VS Code sidebar",
  "version": "0.0.1",
  "publisher": "your-publisher",
  "engines": {
    "vscode": "^1.95.0"
  },
  "activationEvents": [
    "onView:vibeCoder.sidebar"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vibeCoder",
          "title": "Vibe Coder",
          "icon": "media/vibe-icon.svg"
        }
      ]
    },
    "views": {
      "vibeCoder": [
        {
          "id": "vibeCoder.sidebar",
          "name": "Vibe Coder",
          "type": "webview"
        }
      ]
    },
    "commands": [
      {
        "command": "vibeCoder.open",
        "title": "Open Vibe Coder"
      },
      {
        "command": "vibeCoder.clearChat",
        "title": "Vibe Coder: Clear Chat"
      },
      {
        "command": "vibeCoder.setApiKeys",
        "title": "Vibe Coder: Set API Keys"
      }
    ],
    "configuration": {
      "title": "Vibe Coder",
      "properties": {
        "vibeCoder.defaultModel": {
          "type": "string",
          "default": "openai-gpt-5-4-codex",
          "enum": [
            "openai-gpt-5-4-codex",
            "zai-glm-4-7"
          ],
          "description": "Default model used by Vibe Coder."
        },
        "vibeCoder.requireCommandApproval": {
          "type": "boolean",
          "default": true,
          "description": "Ask before running terminal commands."
        },
        "vibeCoder.requireFileEditApproval": {
          "type": "boolean",
          "default": true,
          "description": "Ask before applying file modifications."
        },
        "vibeCoder.maxContextFiles": {
          "type": "number",
          "default": 20,
          "description": "Maximum files to include in one prompt context."
        }
      }
    }
  }
}
```

---

## 6. Folder Structure

```text
vibe-coder/
│
├── package.json
├── tsconfig.json
├── esbuild.js
├── media/
│   ├── vibe-icon.svg
│   └── styles.css
│
├── src/
│   ├── extension.ts
│   │
│   ├── sidebar/
│   │   ├── VibeCoderViewProvider.ts
│   │   ├── webviewHtml.ts
│   │   └── webviewProtocol.ts
│   │
│   ├── core/
│   │   ├── agent/
│   │   │   ├── AgentOrchestrator.ts
│   │   │   ├── AgentPromptBuilder.ts
│   │   │   ├── AgentActionParser.ts
│   │   │   └── AgentTypes.ts
│   │   │
│   │   ├── models/
│   │   │   ├── ModelAdapter.ts
│   │   │   ├── ModelRegistry.ts
│   │   │   ├── OpenAIResponsesAdapter.ts
│   │   │   └── ZaiGlmAdapter.ts
│   │   │
│   │   ├── workspace/
│   │   │   ├── WorkspaceContextService.ts
│   │   │   ├── FileReadService.ts
│   │   │   ├── FileWriteService.ts
│   │   │   ├── PatchService.ts
│   │   │   └── WorkspaceSearchService.ts
│   │   │
│   │   ├── terminal/
│   │   │   ├── CommandExecutionService.ts
│   │   │   └── CommandPolicy.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── SecretManager.ts
│   │   │   └── ExtensionSettingsService.ts
│   │   │
│   │   └── utils/
│   │       ├── logger.ts
│   │       ├── errors.ts
│   │       └── jsonRepair.ts
│   │
│   └── test/
│       ├── AgentActionParser.test.ts
│       ├── PatchService.test.ts
│       └── ModelRegistry.test.ts
```

---

## 7. Core Components

## 7.1 `extension.ts`

### Responsibility

Main activation entry point.

### Tasks

* Register sidebar provider.
* Register commands.
* Initialize services.
* Wire dependencies.

### Pseudocode

```ts
export function activate(context: vscode.ExtensionContext) {
  const secretManager = new SecretManager(context);
  const settingsService = new ExtensionSettingsService();
  const modelRegistry = new ModelRegistry(secretManager);
  const workspaceContext = new WorkspaceContextService();
  const patchService = new PatchService();
  const commandService = new CommandExecutionService(settingsService);
  const orchestrator = new AgentOrchestrator(
    modelRegistry,
    workspaceContext,
    patchService,
    commandService
  );

  const sidebarProvider = new VibeCoderViewProvider(
    context.extensionUri,
    orchestrator,
    secretManager,
    settingsService
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "vibeCoder.sidebar",
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}
```

---

## 7.2 `VibeCoderViewProvider`

### Responsibility

Render sidebar UI and handle communication between Webview and extension host.

### Webview Messages

```ts
type WebviewToExtensionMessage =
  | { type: "submitPrompt"; prompt: string; modelId: string }
  | { type: "saveApiKey"; provider: "openai" | "zai"; apiKey: string }
  | { type: "getSettings" }
  | { type: "clearChat" }
  | { type: "approveAction"; actionId: string }
  | { type: "rejectAction"; actionId: string };
```

```ts
type ExtensionToWebviewMessage =
  | { type: "settingsLoaded"; settings: PublicSettings }
  | { type: "assistantDelta"; text: string }
  | { type: "assistantMessage"; text: string }
  | { type: "actionPreview"; action: AgentAction }
  | { type: "actionResult"; result: AgentActionResult }
  | { type: "error"; message: string };
```

### Important Rule

The Webview must never directly receive saved API keys. It should only show whether a key exists:

```ts
type PublicSettings = {
  selectedModel: string;
  hasOpenAIKey: boolean;
  hasZaiKey: boolean;
  requireCommandApproval: boolean;
  requireFileEditApproval: boolean;
};
```

---

## 8. Sidebar UI LLD

## 8.1 UI Layout

```text
┌─────────────────────────────────────┐
│ Vibe Coder                          │
│ Model: [ GPT-5.4 Codex v ]          │
├─────────────────────────────────────┤
│ Chat / Activity Window              │
│                                     │
│ User: Fix this API error            │
│ AI: I will inspect routes...        │
│ Action: Read file src/api.ts        │
│ Action: Patch file src/api.ts       │
│ Action: Run npm test                │
│                                     │
├─────────────────────────────────────┤
│ Prompt box                          │
│ [ Ask Vibe Coder to build/fix... ]  │
│ [ Send ]                            │
├─────────────────────────────────────┤
│ Settings                            │
│ OpenAI API Key: [ ******** ] Save   │
│ Z.AI API Key:   [ ******** ] Save   │
│ Require command approval: [x]       │
│ Require edit approval:    [x]       │
└─────────────────────────────────────┘
```

## 8.2 UI Components

### `ModelSelector`

Options:

```ts
[
  {
    label: "GPT-5.4 Codex",
    internalId: "openai-gpt-5-4-codex",
    provider: "openai",
    apiModel: "gpt-5.4"
  },
  {
    label: "GLM-4.7",
    internalId: "zai-glm-4-7",
    provider: "zai",
    apiModel: "glm-4.7"
  }
]
```

### `PromptBox`

Features:

* Multiline textarea.
* `Enter` sends.
* `Shift + Enter` adds new line.
* Disabled when no API key exists for selected provider.
* Shows active workspace root.

### `SettingsPanel`

Fields:

* OpenAI API key input.
* Z.AI API key input.
* Save buttons.
* Delete key buttons.
* Require approval toggles.

### `ActionPreviewCard`

Used before applying file edits or running commands.

```text
Action: Patch File
File: src/server.ts
Summary: Replace hardcoded port with env variable

[View Diff] [Approve] [Reject]
```

---

## 9. Model Registry

### Responsibility

Map UI model IDs to actual providers and API model IDs.

```ts
type ModelProvider = "openai" | "zai";

type ModelConfig = {
  internalId: string;
  label: string;
  provider: ModelProvider;
  apiModel: string;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
};
```

```ts
const MODELS: ModelConfig[] = [
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
```

OpenAI’s Responses API supports agent-like applications, multi-turn interactions, built-in tools, and streaming events; GLM-4.7’s docs list streaming, function calling, structured output, and the `glm-4.7` model ID using Z.AI’s chat completions endpoint. ([OpenAI Developers][4])

---

## 10. Model Adapter Interface

```ts
export interface ModelAdapter {
  streamAgentResponse(input: AgentModelInput): AsyncGenerator<ModelStreamEvent>;
}
```

```ts
export type AgentModelInput = {
  model: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  workspaceContext: WorkspaceContext;
  conversation: ChatMessage[];
  availableActions: AgentToolSchema[];
};
```

```ts
export type ModelStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "action"; action: AgentAction }
  | { type: "done" }
  | { type: "error"; error: string };
```

---

## 11. OpenAI Adapter

### File

```text
src/core/models/OpenAIResponsesAdapter.ts
```

### Responsibility

Call OpenAI Responses API directly from extension host.

### Request Design

```ts
const response = await client.responses.stream({
  model: input.model,
  instructions: input.systemPrompt,
  input: [
    ...input.conversation,
    {
      role: "user",
      content: buildUserMessage(input)
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "vibe_coder_actions",
      schema: AgentResponseSchema
    }
  }
});
```

### Output Contract

The model should return:

```json
{
  "assistantMessage": "I found the issue in src/api.ts and will patch it.",
  "actions": [
    {
      "type": "patch_file",
      "path": "src/api.ts",
      "summary": "Fix missing await in API call",
      "unifiedDiff": "--- a/src/api.ts\n+++ b/src/api.ts\n..."
    },
    {
      "type": "run_command",
      "command": "npm test",
      "cwd": ".",
      "summary": "Run test suite after patch"
    }
  ],
  "nextStep": "continue"
}
```

---

## 12. GLM Adapter

### File

```text
src/core/models/ZaiGlmAdapter.ts
```

### Responsibility

Call Z.AI GLM-4.7 API.

### Endpoint

```text
POST /api/paas/v4/chat/completions
```

Z.AI’s GLM-4.7 documentation shows the model ID as `glm-4.7`, supports text input/output, 200K context, 128K maximum output, and uses bearer-token authentication in chat completion calls. ([Z.ai Documentation][5])

### Request Shape

```ts
const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: "glm-4.7",
    stream: true,
    temperature: 0.6,
    max_tokens: 8192,
    thinking: {
      type: "enabled"
    },
    messages: [
      {
        role: "system",
        content: input.systemPrompt
      },
      ...toGlmMessages(input.conversation),
      {
        role: "user",
        content: buildUserMessage(input)
      }
    ]
  })
});
```

---

## 13. Agent Orchestrator

### File

```text
src/core/agent/AgentOrchestrator.ts
```

### Responsibility

Controls the whole coding loop.

### Flow

```text
1. Receive user prompt.
2. Detect selected model.
3. Load API key from SecretStorage.
4. Collect workspace context.
5. Build system prompt.
6. Call model adapter.
7. Stream assistant response to sidebar.
8. Parse actions.
9. For each action:
   - show preview
   - ask approval if required
   - execute action
   - collect result
10. Send action results back to model if nextStep = continue.
11. Stop when nextStep = done or max loop reached.
```

### Loop Control

```ts
const MAX_AGENT_ITERATIONS = 8;
```

This prevents infinite tool loops.

---

## 14. Workspace Context Service

### File

```text
src/core/workspace/WorkspaceContextService.ts
```

### Responsibility

Collect useful code context for the model.

### Context Sources

* Active editor file.
* Current selection.
* Open tabs.
* Workspace root.
* File tree summary.
* Relevant files found by search.
* `package.json`.
* `README.md`.
* `tsconfig.json`.
* `.env.example`, but never `.env`.
* Git diff, if available.

### Data Structure

```ts
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
```

### Excluded Files

```ts
const DEFAULT_EXCLUDES = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".git/**",
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
];
```

---

## 15. File Editing Design

### Supported Actions

```ts
type AgentAction =
  | ReadFileAction
  | WriteFileAction
  | PatchFileAction
  | CreateFileAction
  | DeleteFileAction
  | RunCommandAction;
```

### `PatchFileAction`

```ts
type PatchFileAction = {
  id: string;
  type: "patch_file";
  path: string;
  summary: string;
  unifiedDiff: string;
};
```

### `WriteFileAction`

```ts
type WriteFileAction = {
  id: string;
  type: "write_file";
  path: string;
  summary: string;
  content: string;
};
```

### Application Method

Use `vscode.WorkspaceEdit` for file modifications. VS Code’s `workspace.applyEdit` applies one or many resource changes, and `WorkspaceEdit` supports textual changes plus file create/delete/rename operations. ([Visual Studio Code][3])

### Approval Flow

```text
Model proposes file change
        |
        v
Extension generates diff preview
        |
        v
User approves?
  | yes                 | no
  v                     v
Apply WorkspaceEdit     Skip action
```

---

## 16. Command Execution Design

### File

```text
src/core/terminal/CommandExecutionService.ts
```

### Responsibility

Run commands in the VS Code integrated terminal.

VS Code extensions can create terminals using `window.createTerminal`; shell integration can also execute commands and expose an exit code when supported. ([Visual Studio Code][3])

### Action Shape

```ts
type RunCommandAction = {
  id: string;
  type: "run_command";
  command: string;
  cwd?: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
};
```

### Command Approval Rules

Default: always ask before running.

```ts
const dangerousPatterns = [
  "rm -rf",
  "sudo",
  "mkfs",
  "shutdown",
  "reboot",
  "del /s",
  "format",
  ":(){ :|:& };:",
  "curl * | sh",
  "wget * | sh"
];
```

### Execution Flow

```text
AI requests command
     |
     v
CommandPolicy checks risk
     |
     v
Show command preview
     |
     v
User approves
     |
     v
Run in VS Code terminal
     |
     v
Return result summary to agent
```

### Terminal Execution

```ts
const terminal = vscode.window.createTerminal({
  name: "Vibe Coder",
  cwd: workspaceRoot
});

terminal.show();
terminal.sendText(command);
```

For v1, command output can be captured approximately by asking the user/model to inspect terminal output manually or by using shell integration where available. For stronger capture, add a `node-pty` based pseudoterminal in v2.

---

## 17. Secret Management

### File

```text
src/core/settings/SecretManager.ts
```

### Secret Keys

```ts
const OPENAI_API_KEY = "vibeCoder.openaiApiKey";
const ZAI_API_KEY = "vibeCoder.zaiApiKey";
```

### Methods

```ts
class SecretManager {
  constructor(private context: vscode.ExtensionContext) {}

  async saveApiKey(provider: "openai" | "zai", value: string): Promise<void> {}

  async getApiKey(provider: "openai" | "zai"): Promise<string | undefined> {}

  async deleteApiKey(provider: "openai" | "zai"): Promise<void> {}

  async hasApiKey(provider: "openai" | "zai"): Promise<boolean> {}
}
```

### Rule

Never store API keys in:

* `settings.json`
* workspace files
* webview localStorage
* logs
* telemetry
* chat history

---

## 18. Agent System Prompt

```text
You are Vibe Coder, an autonomous coding assistant running inside VS Code.

You can inspect the workspace, propose file edits, create files, delete files, and request terminal commands.

You must respond using the required JSON action format.

Rules:
1. Never modify files without producing an explicit action.
2. Prefer minimal, targeted edits.
3. Read relevant files before editing.
4. Do not touch secrets, .env files, private keys, or credentials.
5. For terminal commands, provide a clear summary and risk level.
6. For destructive commands, always mark riskLevel as high.
7. After edits, run the smallest useful validation command, such as npm test, npm run build, cargo check, pytest, or similar.
8. If context is insufficient, request read_file actions instead of guessing.
9. Do not hallucinate files. Only reference files from workspace context or read_file results.
10. Return valid JSON only.
```

---

## 19. Agent Action JSON Schema

```ts
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
```

---

## 20. Error Handling

| Error                 | Handling                                           |
| --------------------- | -------------------------------------------------- |
| Missing API key       | Show settings panel with key field highlighted     |
| Invalid API key       | Show provider-specific auth error                  |
| Rate limit            | Show retry message                                 |
| JSON parse failure    | Try JSON repair once, then ask model to regenerate |
| Patch failure         | Show failed file and reason                        |
| File not found        | Ask model to re-check workspace                    |
| Command rejected      | Return rejected result to agent                    |
| Command failed        | Send exit/error summary back to agent              |
| Network failure       | Show retry option                                  |
| Workspace not trusted | Disable file edits and command execution           |

---

## 21. Security Design

### Must-Have Security Rules

1. API keys stored only in SecretStorage.
2. Webview never receives raw API keys.
3. File edits require preview by default.
4. Commands require approval by default.
5. Dangerous commands get high-risk warnings.
6. `.env`, private keys, certificates, SSH keys, and credentials are excluded from context.
7. No telemetry in v1.
8. No external backend.
9. No automatic command execution unless user disables approval manually.
10. The model can request actions, but the extension decides whether to execute them.

This separation is important: the AI should not directly control the system. It should only produce structured action requests.

---

## 22. Development Milestones

### Milestone 1: Basic Extension Shell

* Create VS Code extension.
* Add Activity Bar icon.
* Add sidebar Webview.
* Add prompt box.
* Add static model selector.
* Add settings panel.

### Milestone 2: Secret Storage

* Save OpenAI key.
* Save Z.AI key.
* Show key saved status.
* Delete key support.

### Milestone 3: Basic Chat

* Implement OpenAI adapter.
* Implement GLM adapter.
* Stream response to sidebar.
* Store local conversation in memory.

### Milestone 4: Workspace Context

* Read active file.
* Read selected text.
* Read open files.
* Build file tree.
* Add exclude rules.

### Milestone 5: Agent Actions

* Add JSON action parser.
* Add read file action.
* Add write file action.
* Add patch file action.
* Add diff preview.
* Add approval flow.

### Milestone 6: Terminal Commands

* Add run command action.
* Add command approval modal.
* Run command in VS Code terminal.
* Return command status to chat.

### Milestone 7: Polish

* Better UI.
* Loading states.
* Error handling.
* Stop generation button.
* Clear chat button.
* Logging output channel.
* Unit tests.

---

## 23. Final Recommended Implementation Approach

Build the first version as a **single VS Code extension with a Webview sidebar**, not as a separate app. Keep all sensitive and privileged operations inside the extension host, not the Webview. Use the Webview only for UI. Use a common internal action schema so OpenAI and GLM can both drive the same file-editing and command-execution system.

For the model list, use this design:

```ts
{
  label: "GPT-5.4 Codex",
  apiModel: "gpt-5.4"
}
```

or switch later to:

```ts
{
  label: "G PT-5 Codex",
  apiModel: "gpt-5-codex"
}
```

The key point: do **not** hardcode the UI label as the API model ID. Keep them separate.
