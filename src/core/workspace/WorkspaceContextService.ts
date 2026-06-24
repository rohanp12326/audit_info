import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { WorkspaceContext, WorkspaceFile } from "../agent/AgentTypes";

const DEFAULT_EXCLUDES = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".env",
  ".pem",
  ".key",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
];

export class WorkspaceContextService {
  getRootPath(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
  }

  async getContext(maxContextFiles = 20): Promise<WorkspaceContext> {
    const rootPath = this.getRootPath();
    if (!rootPath) {
      return { rootPath: "", openFiles: [], relevantFiles: [], fileTree: [] };
    }

    const activeFile = this.getActiveFileContext();
    const openFiles = await this.getOpenFilesContext(rootPath);
    const relevantFiles = await this.getRelevantFilesContext(rootPath);
    const fileTree = this.getFileTree(rootPath);
    const gitDiff = await this.getGitDiff(rootPath);

    return {
      rootPath,
      activeFile,
      openFiles: openFiles.slice(0, maxContextFiles),
      relevantFiles: relevantFiles.slice(0, maxContextFiles),
      fileTree,
      gitDiff
    };
  }

  private getActiveFileContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const doc = editor.document;
    if (doc.uri.scheme !== "file") {
      return undefined;
    }

    const selection = editor.selection;
    let selectedText: string | undefined;
    if (selection && !selection.isEmpty) {
      selectedText = doc.getText(selection);
    }

    return {
      path: vscode.workspace.asRelativePath(doc.uri),
      languageId: doc.languageId,
      content: doc.getText(),
      selection: selectedText
    };
  }

  private async getOpenFilesContext(rootPath: string): Promise<WorkspaceFile[]> {
    const files: WorkspaceFile[] = [];
    const openDocs = vscode.workspace.textDocuments;

    for (const doc of openDocs) {
      if (doc.uri.scheme === "file" && !doc.isClosed) {
        const filePath = doc.uri.fsPath;
        if (filePath.startsWith(rootPath) && !this.isExcluded(filePath)) {
          files.push({
            path: vscode.workspace.asRelativePath(doc.uri),
            sizeBytes: fs.statSync(filePath).size,
            content: doc.getText()
          });
        }
      }
    }
    return files;
  }

  private async getRelevantFilesContext(rootPath: string): Promise<WorkspaceFile[]> {
    // Collect standard project configuration files
    const configFiles = ["package.json", "README.md", "tsconfig.json", ".env.example"];
    const files: WorkspaceFile[] = [];

    for (const file of configFiles) {
      const fullPath = path.join(rootPath, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          files.push({
            path: file,
            sizeBytes: fs.statSync(fullPath).size,
            content
          });
        } catch (e) {
          // ignore read error
        }
      }
    }
    return files;
  }

  private getFileTree(rootPath: string): string[] {
    const tree: string[] = [];
    const walk = (dir: string, depth = 0) => {
      if (depth > 3) {
        return; // Max depth 3
      }
      if (tree.length > 100) {
        return; // Max 100 items in tree
      }

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (this.isExcluded(fullPath)) {
            continue;
          }

          const relativePath = path.relative(rootPath, fullPath);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            tree.push(relativePath + "/");
            walk(fullPath, depth + 1);
          } else {
            tree.push(relativePath);
          }
        }
      } catch (err) {
        // ignore dir read errors
      }
    };

    walk(rootPath);
    return tree;
  }

  private getGitDiff(rootPath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      exec("git diff", { cwd: rootPath }, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(undefined);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  private isExcluded(filePath: string): boolean {
    const base = path.basename(filePath);
    if (DEFAULT_EXCLUDES.includes(base)) {
      return true;
    }
    
    // Check if any directory segment is in DEFAULT_EXCLUDES
    const parts = filePath.split(path.sep);
    for (const part of parts) {
      if (DEFAULT_EXCLUDES.includes(part)) {
        return true;
      }
    }
    
    // File extension exclusions
    const ext = path.extname(filePath);
    if (ext === ".pem" || ext === ".key") {
      return true;
    }

    return false;
  }
}
