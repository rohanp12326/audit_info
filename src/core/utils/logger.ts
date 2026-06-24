import * as vscode from "vscode";

export class Logger {
  private static channel: vscode.OutputChannel | undefined;

  static initialize() {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel("Audit AI");
    }
  }

  static info(message: string) {
    this.initialize();
    this.channel?.appendLine(`[INFO] [${new Date().toISOString()}] ${message}`);
  }

  static warn(message: string) {
    this.initialize();
    this.channel?.appendLine(`[WARN] [${new Date().toISOString()}] ${message}`);
  }

  static error(message: string, error?: any) {
    this.initialize();
    this.channel?.appendLine(`[ERROR] [${new Date().toISOString()}] ${message}`);
    if (error) {
      if (error instanceof Error) {
        this.channel?.appendLine(error.stack || error.message);
      } else {
        this.channel?.appendLine(JSON.stringify(error));
      }
    }
  }

  static show() {
    this.channel?.show();
  }
}
