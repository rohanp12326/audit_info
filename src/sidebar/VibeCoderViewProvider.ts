import * as vscode from "vscode";
import { AgentOrchestrator } from "../core/agent/AgentOrchestrator";
import { SecretManager } from "../core/settings/SecretManager";
import { ExtensionSettingsService } from "../core/settings/ExtensionSettingsService";
import { getWebviewHtml } from "./webviewHtml";
import { PublicSettings, WebviewToExtensionMessage, ChatSession } from "./webviewProtocol";
import { Logger } from "../core/utils/logger";

export class VibeCoderViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private sessions: ChatSession[] = [];
  private currentSessionId = "";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly orchestrator: AgentOrchestrator,
    private readonly secretManager: SecretManager,
    private readonly settingsService: ExtensionSettingsService
  ) {
    // Load sessions from workspaceState on activation
    this.sessions = this.context.workspaceState.get<ChatSession[]>("auditAi.sessions", []);
    if (this.sessions.length === 0) {
      this.createNewSession();
    } else {
      this.currentSessionId = this.sessions[0].id;
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.context.extensionUri);

    // Listen to messages from the webview
    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleWebviewMessage(message);
    });

    // Send initial settings
    this.sendSettings();
    
    // Send sessions list
    this.sendSessionsList();
    
    // Load active session data in UI
    const activeSession = this.sessions.find(s => s.id === this.currentSessionId);
    if (activeSession) {
      setTimeout(() => {
        this.postToWebview({
          type: "loadSessionData",
          conversation: activeSession.conversation,
          modelId: activeSession.modelId,
          sessionId: activeSession.id
        });
      }, 300);
    }
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage) {
    try {
      switch (message.type) {
        case "getSettings":
          await this.sendSettings();
          this.sendSessionsList();
          break;

        case "saveApiKey":
          await this.secretManager.saveApiKey(message.provider, message.apiKey);
          vscode.window.showInformationMessage(`Audit AI: API key for ${message.provider === "openai" ? "OpenAI" : "Z.AI"} saved.`);
          await this.sendSettings();
          break;

        case "deleteApiKey":
          await this.secretManager.deleteApiKey(message.provider);
          vscode.window.showInformationMessage(`Audit AI: API key for ${message.provider === "openai" ? "OpenAI" : "Z.AI"} deleted.`);
          await this.sendSettings();
          break;

        case "updateApprovalSettings":
          const config = vscode.workspace.getConfiguration("vibeCoder");
          await config.update("requireCommandApproval", message.requireCommandApproval, vscode.ConfigurationTarget.Global);
          await config.update("requireFileEditApproval", message.requireFileEditApproval, vscode.ConfigurationTarget.Global);
          break;

        case "clearChat":
          this.clearChat();
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
          vscode.window.showWarningMessage("Audit AI: Execution cancelled.");
          break;

        case "submitPrompt":
          await this.handleSubmitPrompt(message.prompt, message.modelId, message.isGovernanceCheck);
          break;

        case "loadSession":
          const sess = this.sessions.find(s => s.id === message.sessionId);
          if (sess) {
            this.currentSessionId = sess.id;
            this.postToWebview({
              type: "loadSessionData",
              conversation: sess.conversation,
              modelId: sess.modelId,
              sessionId: sess.id
            });
            this.sendSessionsList();
          }
          break;

        case "deleteSession":
          this.sessions = this.sessions.filter(s => s.id !== message.sessionId);
          if (this.sessions.length === 0) {
            this.createNewSession();
          } else if (this.currentSessionId === message.sessionId) {
            this.currentSessionId = this.sessions[0].id;
          }
          this.saveSessions();
          
          const activeSess = this.sessions.find(s => s.id === this.currentSessionId);
          if (activeSess) {
            this.postToWebview({
              type: "loadSessionData",
              conversation: activeSess.conversation,
              modelId: activeSess.modelId,
              sessionId: activeSess.id
            });
          }
          break;

        case "newChat":
          const newSess = this.createNewSession();
          this.postToWebview({
            type: "loadSessionData",
            conversation: newSess.conversation,
            modelId: newSess.modelId,
            sessionId: newSess.id
          });
          break;
      }
    } catch (err: any) {
      Logger.error("Failed to handle webview message", err);
      this.postToWebview({ type: "error", message: err?.message || String(err) });
    }
  }

  private async handleSubmitPrompt(prompt: string, modelId: string, isGovernanceCheck?: boolean) {
    if (!this.view) return;

    let session = this.sessions.find(s => s.id === this.currentSessionId);
    if (!session) {
      session = this.createNewSession(isGovernanceCheck ? "🛡️ AI Governance Check" : prompt.substring(0, 30), modelId);
    }

    session.modelId = modelId;
    if (session.title === "New Chat" && session.conversation.length === 0) {
      session.title = isGovernanceCheck ? "🛡️ AI Governance Check" : (prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""));
    }

    // Add user message to history
    session.conversation.push({ role: "user", content: prompt });
    this.saveSessions();

    const requireFileEditApproval = this.settingsService.getRequireFileEditApproval();
    const requireCommandApproval = this.settingsService.getRequireCommandApproval();

    // Run the orchestrator loop
    await this.orchestrator.run(
      modelId,
      prompt,
      session.conversation,
      {
        onTextDelta: (text) => {
          this.postToWebview({ type: "assistantDelta", text });
        },
        onMessageComplete: (text) => {
          this.postToWebview({ type: "assistantMessage", text });
          session!.conversation.push({ role: "assistant", content: text });
          this.saveSessions();
        },
        onActionPreview: (action) => {
          this.postToWebview({ type: "actionPreview", action });
        },
        onActionResult: (result) => {
          this.postToWebview({ type: "actionResult", result });
          
          const outcome = result.success 
            ? `Action ID: ${result.actionId} succeeded.` 
            : `Action ID: ${result.actionId} failed: ${result.error || ""}`;
          
          session!.conversation.push({ role: "system", content: outcome });
          this.saveSessions();
        },
        onCommandOutput: (text) => {
          this.postToWebview({ type: "commandOutput", text });
        },
        onError: (errMessage) => {
          this.postToWebview({ type: "error", message: errMessage });
        }
      },
      requireFileEditApproval,
      requireCommandApproval,
      isGovernanceCheck
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

  private createNewSession(title = "New Chat", modelId?: string): ChatSession {
    const defaultModel = modelId || this.settingsService.getDefaultModel();
    const newSession: ChatSession = {
      id: Math.random().toString(36).substring(2, 11),
      title: title,
      timestamp: Date.now(),
      conversation: [],
      modelId: defaultModel
    };
    this.sessions.unshift(newSession);
    this.currentSessionId = newSession.id;
    this.saveSessions();
    return newSession;
  }

  private saveSessions() {
    this.context.workspaceState.update("auditAi.sessions", this.sessions);
    this.sendSessionsList();
  }

  private sendSessionsList() {
    const list = this.sessions.map(s => ({
      id: s.id,
      title: s.title,
      timestamp: s.timestamp,
      modelId: s.modelId
    }));
    this.postToWebview({
      type: "sessionsLoaded",
      sessions: list,
      currentSessionId: this.currentSessionId
    });
  }

  public clearChat() {
    const session = this.sessions.find(s => s.id === this.currentSessionId);
    if (session) {
      session.conversation = [];
      session.title = "New Chat";
      this.orchestrator.cancelAll();
      this.saveSessions();
      this.postToWebview({
        type: "loadSessionData",
        conversation: [],
        modelId: session.modelId,
        sessionId: session.id
      });
    }
  }

  private postToWebview(message: any) {
    this.view?.webview.postMessage(message);
  }
}
