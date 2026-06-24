import * as vscode from "vscode";
import { SecretManager } from "./core/settings/SecretManager";
import { ExtensionSettingsService } from "./core/settings/ExtensionSettingsService";
import { ModelRegistry } from "./core/models/ModelRegistry";
import { WorkspaceContextService } from "./core/workspace/WorkspaceContextService";
import { PatchService } from "./core/workspace/PatchService";
import { CommandExecutionService } from "./core/terminal/CommandExecutionService";
import { AgentOrchestrator } from "./core/agent/AgentOrchestrator";
import { VibeCoderViewProvider } from "./sidebar/VibeCoderViewProvider";
import { Logger } from "./core/utils/logger";

export function activate(context: vscode.ExtensionContext) {
  Logger.initialize();
  Logger.info("Audit AI Extension Activating...");

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
    context,
    orchestrator,
    secretManager,
    settingsService
  );

  // Register Webview View Provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "vibeCoder.sidebar",
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Register Command: Open Sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand("vibeCoder.open", () => {
      vscode.commands.executeCommand("vibeCoder.sidebar.focus");
    })
  );

  // Register Command: Clear Chat
  context.subscriptions.push(
    vscode.commands.registerCommand("vibeCoder.clearChat", () => {
      sidebarProvider.clearChat();
      vscode.window.showInformationMessage("Audit AI chat history cleared.");
    })
  );

  // Register Command: Set API Keys Prompt Flow
  context.subscriptions.push(
    vscode.commands.registerCommand("vibeCoder.setApiKeys", async () => {
      const provider = await vscode.window.showQuickPick(
        [
          { label: "OpenAI", description: "Save OpenAI API key (gpt-5.4)", value: "openai" },
          { label: "Z.AI GLM", description: "Save Z.AI API key (glm-4.7)", value: "zai" }
        ],
        { placeHolder: "Select API Key Provider to set" }
      );

      if (!provider) return;

      const apiKey = await vscode.window.showInputBox({
        prompt: `Enter API key for ${provider.label}`,
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey !== undefined) {
        if (apiKey.trim()) {
          await secretManager.saveApiKey(provider.value as "openai" | "zai", apiKey.trim());
          vscode.window.showInformationMessage(`Audit AI: API key for ${provider.label} saved securely.`);
        } else {
          await secretManager.deleteApiKey(provider.value as "openai" | "zai");
          vscode.window.showInformationMessage(`Audit AI: API key for ${provider.label} removed.`);
        }
      }
    })
  );

  Logger.info("Audit AI Extension Activated Successfully.");
}

export function deactivate() {
  Logger.info("Audit AI Extension Deactivated.");
}
