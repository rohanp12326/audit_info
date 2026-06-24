# Audit AI VS Code Extension

Audit AI is an autonomous, AI-powered coding companion and compliance auditor built directly into the VS Code sidebar. It orchestrates a multi-turn developer loop to inspect workspaces, write and patch files, and execute verification commands, while also offering a dedicated **AI Governance & Risk Auditor** to analyze codebases against safety and compliance standards.

---

## 🚀 Key Features

### 💻 Agentic Coding Mode
* **Multi-Turn AI Loop:** Orchestrates an autonomous reasoning loop (up to 8 iterations) of thinking, acting, inspecting results, and refining solutions.
* **Workspace Interaction:** Safely reads, writes, patches, creates, or deletes files directly inside the workspace based on user instructions.
* **Smart Command Execution:** Proposes terminal commands (e.g. running tests, installing dependencies, or building projects) to validate edits, classified into `low`, `medium`, and `high` risk categories.

### 🛡️ AI Governance & Risk Audit Mode
Analyze your codebase against **five core governance pillars** in a read-only audit mode, generating detailed reports without making any changes to files:
1. **SAFE:** Checks for safety vulnerabilities, robust error handling, and hazard avoidance.
2. **EXPLAINABLE:** Analyzes transparency, model interpretability, and clear algorithmic logic flow.
3. **UNBIASED:** Detects and suggests mitigation strategies for algorithmic bias or unfairness.
4. **PRIVACY-AWARE:** Evaluates GDPR/CCPA compliance, data protection, and handling of Personally Identifiable Information (PII).
5. **REGULATOR-READY:** Audits logging adequacy, compliance documentation, and general audit readiness.

### 🔒 Privacy & Safety Controls
* **Secure API Keys:** Saves OpenAI and Z.AI keys locally using VS Code’s native, secure `SecretStorage` API (keys never touch the webview UI).
* **Dual Approval Gates:** Toggleable controls to require explicit user approval before executing terminal commands or modifying workspace files.
* **Local Architecture:** Direct HTTPS calls to APIs with zero telemetry or custom backend servers.

### ⚙️ Multi-Model Integration
* **GPT-5.4 Codex:** Powered by the OpenAI Responses API for advanced structured tool actions and agent-like streaming.
* **GLM-4.7:** Powered by Z.AI completions API for fast reasoning and code generation.

---

## 📁 Project Architecture & Components

```
auditAI/
├── src/
│   ├── extension.ts                   # Extension entry point & service wiring
│   ├── sidebar/                       # Webview UI and views providers
│   │   ├── VibeCoderViewProvider.ts   # Bridge between webview and extension services
│   │   ├── webviewHtml.ts             # Webview HTML content injection
│   │   └── webviewProtocol.ts         # Type definitions for postMessage bridge
│   ├── core/
│   │   ├── agent/                     # Autonomous agent orchestrator
│   │   │   ├── AgentOrchestrator.ts   # Core execution loop (think -> act -> inspect)
│   │   │   ├── AgentPromptBuilder.ts  # Context-aware developer & auditor system prompts
│   │   │   ├── AgentActionParser.ts   # Parses & normalizes JSON-structured action outputs
│   │   │   └── AgentTypes.ts          # Core type definitions and JSON schemas
│   │   ├── models/                    # Model adapters
│   │   │   ├── ModelRegistry.ts       # Model configurations mapping
│   │   │   ├── ModelAdapter.ts        # Base adapter interface
│   │   │   ├── OpenAIResponsesAdapter.ts # OpenAI Responses streaming interface
│   │   │   └── ZaiGlmAdapter.ts       # Z.AI GLM completions interface
│   │   ├── workspace/                 # Workspace file operation services
│   │   │   ├── WorkspaceContextService.ts # Context aggregator (file tree, active file, git diff)
│   │   │   ├── FileReadService.ts     # Safe file system reader
│   │   │   ├── FileWriteService.ts    # Safe file writer/creator
│   │   │   └── PatchService.ts        # Diff application service (applies unified diffs)
│   │   ├── terminal/                  # Terminal services
│   │   │   ├── CommandExecutionService.ts # Runs terminal scripts and handles streams
│   │   │   └── CommandPolicy.ts       # Command risk classification rules
│   │   └── utils/                     # Helper modules (logger, JSON repair, custom errors)
│   └── test/                          # Unit and integration test suites
├── media/                             # Assets (CSS styling, icons)
├── package.json                       # Extension configurations and contributions
├── esbuild.js                         # Bundling script for extension compilation
└── tsconfig.json                      # TypeScript configuration
```

---

## 🛠️ Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Visual Studio Code](https://code.visualstudio.com/) (v1.95.0 or higher)

### Setup & Installation
1. Clone the repository and navigate to the directory:
   ```bash
   git clone <repository-url>
   cd auditAI
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Extension Locally
1. Open the project directory in VS Code:
   ```bash
   code .
   ```
2. Press `F5` (or go to `Run and Debug` -> select **Run Extension**) to launch a new VS Code Extension Development Host window.
3. In the new window, look for the **Audit AI** icon in the Activity Bar on the side.
4. Click on it to open the sidebar. Add your API keys under Settings to start using it!

### Running the Test Suite
Launch the automated tests to verify service integrity (uses Mocha + VS Code Extension Test Runner):
```bash
npm run test
```

---

## 🔧 Useful Scripts

* `npm run compile` - Compiles TypeScript source code and packages it with Esbuild.
* `npm run watch` - Starts a development watcher to build code incrementally on save.
* `npm run check-types` - Performs a quick compilation check using `tsc --noEmit`.
* `npm run test` - Runs the extension host integration tests.

---

## ⚙️ Configuration Settings

Audit AI introduces several user settings in VS Code under `File > Preferences > Settings`:

| Configuration Key | Type | Default | Description |
|---|---|---|---|
| `vibeCoder.defaultModel` | `string` | `"openai-gpt-5-4-codex"` | Default model to use (`openai-gpt-5-4-codex` or `zai-glm-4-7`). |
| `vibeCoder.requireCommandApproval` | `boolean` | `true` | Ask for permission before running terminal commands. |
| `vibeCoder.requireFileEditApproval` | `boolean` | `true` | Ask for permission before modifying/writing/patching files. |
| `vibeCoder.maxContextFiles` | `number` | `20` | Max workspace files to feed into the prompt context at once. |

---

## 📚 Development & Contribution

* **Action Validation:** The agent communicates with the extension via structured JSON. Validating outputs is handled by `AgentActionParser.ts`.
* **JSON Repair:** Models sometimes output slightly malformed JSON or wrap it in extra text. `jsonRepair.ts` is used to robustly extract and format JSON responses.
* **Diff Patches:** Unified diff patches generated by models are applied locally using the helper functions in `PatchService.ts`.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
