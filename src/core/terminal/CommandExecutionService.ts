import * as vscode from "vscode";
import { spawn } from "child_process";
import { ExtensionSettingsService } from "../settings/ExtensionSettingsService";
import { Logger } from "../utils/logger";

export class CommandExecutionService {
  constructor(_settingsService: ExtensionSettingsService) {}

  async executeCommand(
    command: string,
    workspaceRoot: string,
    onOutput?: (chunk: string) => void
  ): Promise<{ success: boolean; output: string; exitCode: number | null }> {
    Logger.info(`Executing command: ${command} in ${workspaceRoot}`);

    return new Promise((resolve) => {
      // Use bash/sh or cmd depending on platform
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const shellArgs = process.platform === "win32" ? ["/d", "/c", command] : ["-c", command];

      const child = spawn(shell, shellArgs, {
        cwd: workspaceRoot,
        env: { ...process.env, FORCE_COLOR: "true" }
      });

      let accumulatedOutput = "";

      child.stdout.on("data", (data) => {
        const chunk = data.toString();
        accumulatedOutput += chunk;
        if (onOutput) {
          onOutput(chunk);
        }
      });

      child.stderr.on("data", (data) => {
        const chunk = data.toString();
        accumulatedOutput += chunk;
        if (onOutput) {
          onOutput(chunk);
        }
      });

      child.on("error", (err) => {
        accumulatedOutput += `\nError spawning command: ${err.message}\n`;
        Logger.error(`Command error: ${command}`, err);
        resolve({
          success: false,
          output: accumulatedOutput,
          exitCode: -1
        });
      });

      child.on("exit", (code) => {
        Logger.info(`Command "${command}" exited with code ${code}`);
        resolve({
          success: code === 0,
          output: accumulatedOutput,
          exitCode: code
        });
      });
    });
  }

  // Fallback to write directly to a VS Code terminal window if requested
  executeInVSCodeTerminal(command: string, workspaceRoot: string): void {
    const terminal = vscode.window.terminals.find(t => t.name === "Vibe Coder") || 
                     vscode.window.createTerminal({ name: "Vibe Coder", cwd: workspaceRoot });
    
    terminal.show();
    terminal.sendText(command);
  }
}
