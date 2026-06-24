import * as vscode from "vscode";

export class ExtensionSettingsService {
  getDefaultModel(): string {
    return vscode.workspace.getConfiguration("vibeCoder").get<string>("defaultModel", "openai-gpt-5-4-codex");
  }

  getRequireCommandApproval(): boolean {
    return vscode.workspace.getConfiguration("vibeCoder").get<boolean>("requireCommandApproval", true);
  }

  getRequireFileEditApproval(): boolean {
    return vscode.workspace.getConfiguration("vibeCoder").get<boolean>("requireFileEditApproval", true);
  }

  getMaxContextFiles(): number {
    return vscode.workspace.getConfiguration("vibeCoder").get<number>("maxContextFiles", 20);
  }
}
