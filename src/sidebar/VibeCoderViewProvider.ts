import * as vscode from "vscode";
import { AgentOrchestrator } from "../core/agent/AgentOrchestrator";
import { SecretManager } from "../core/settings/SecretManager";
import { ExtensionSettingsService } from "../core/settings/ExtensionSettingsService";
import { getWebviewHtml } from "./webviewHtml";
import { ChatMessage } from "../core/agent/AgentTypes";
import { PublicSettings, WebviewToExtensionMessage } from "./webviewProtocol";
import { Logger } from "../core/utils/logger";

export class VibeCoderViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private conversation: ChatMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly orchestrator: AgentOrchestrator,
    private readonly secretManager: SecretManager,
    private readonly settingsService: ExtensionSettingsService
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);

    // Listen to messages from the webview
    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleWebviewMessage(message);
    });

    // Send initial settings
    this.sendSettings();
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage) {
    try {
      switch (message.type) {
        case "getSettings":
          await this.sendSettings();
          break;

        case "saveApiKey":
          await this.secretManager.saveApiKey(message.provider, message.apiKey);
          vscode.window.showInformationMessage(`Vibe Coder: API key for ${message.provider === "openai" ? "OpenAI" : "Z.AI"} saved.`);
          await this.sendSettings();
          break;

        case "deleteApiKey":
          await this.secretManager.deleteApiKey(message.provider);
          vscode.window.showInformationMessage(`Vibe Coder: API key for ${message.provider === "openai" ? "OpenAI" : "Z.AI"} deleted.`);
          await this.sendSettings();
          break;

        case "updateApprovalSettings":
          const config = vscode.workspace.getConfiguration("vibeCoder");
          await config.update("requireCommandApproval", message.requireCommandApproval, vscode.ConfigurationTarget.Global);
          await config.update("requireFileEditApproval", message.requireFileEditApproval, vscode.ConfigurationTarget.Global);
          break;

        case "clearChat":
          this.conversation = [];
          this.orchestrator.cancelAll();
          break;

        case "approveAction":
          this.orchestrator.approveAction(message.actionId);
          break;

        case "rejectAction":
          this.orchestrator.rejectAction(message.actionId);
          break;

        case "cancelExecution":
          this.orchestrator.cancelAll();
          this.postToWebview({ type: "loopFinished" });
          vscode.window.showWarningMessage("Vibe Coder: Execution cancelled.");
          break;

        case "submitPrompt":
          await this.handleSubmitPrompt(message.prompt, message.modelId);
          break;
      }
    } catch (err: any) {
      Logger.error("Failed to handle webview message", err);
      this.postToWebview({ type: "error", message: err?.message || String(err) });
    }
  }

  private async handleSubmitPrompt(prompt: string, modelId: string) {
    if (!this.view) return;

    // Add user message to local history
    this.conversation.push({ role: "user", content: prompt });

    const requireFileEditApproval = this.settingsService.getRequireFileEditApproval();
    const requireCommandApproval = this.settingsService.getRequireCommandApproval();

    // Run the orchestrator loop
    await this.orchestrator.run(
      modelId,
      prompt,
      this.conversation,
      {
        onTextDelta: (text) => {
          this.postToWebview({ type: "assistantDelta", text });
        },
        onMessageComplete: (text) => {
          this.postToWebview({ type: "assistantMessage", text });
          // Save complete assistant message to our local memory copy
          this.conversation.push({ role: "assistant", content: text });
        },
        onActionPreview: (action) => {
          this.postToWebview({ type: "actionPreview", action });
        },
        onActionResult: (result) => {
          this.postToWebview({ type: "actionResult", result });
          
          // Construct message history record for actions outcomes
          const outcome = result.success 
            ? `Action ID: ${result.actionId} succeeded.` 
            : `Action ID: ${result.actionId} failed: ${result.error || ""}`;
          
          this.conversation.push({ role: "system", content: outcome });
        },
        onCommandOutput: (text) => {
          this.postToWebview({ type: "commandOutput", text });
        },
        onError: (errMessage) => {
          this.postToWebview({ type: "error", message: errMessage });
        }
      },
      requireFileEditApproval,
      requireCommandApproval
    );

    this.postToWebview({ type: "loopFinished" });
  }

  private async sendSettings() {
    const hasOpenAIKey = await this.secretManager.hasApiKey("openai");
    const hasZaiKey = await this.secretManager.hasApiKey("zai");

    const settings: PublicSettings = {
      selectedModel: this.settingsService.getDefaultModel(),
      hasOpenAIKey,
      hasZaiKey,
      requireCommandApproval: this.settingsService.getRequireCommandApproval(),
      requireFileEditApproval: this.settingsService.getRequireFileEditApproval()
    };

    this.postToWebview({ type: "settingsLoaded", settings });
  }

  public clearChat() {
    this.conversation = [];
    this.orchestrator.cancelAll();
    this.postToWebview({ type: "assistantMessage", text: "Hello! I am Vibe Coder, your autonomous coding agent. Ask me to fix a bug, build a feature, or explore your workspace files!" });
    this.sendSettings();
  }

  private postToWebview(message: any) {
    this.view?.webview.postMessage(message);
  }
}

