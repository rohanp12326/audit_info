import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export class FileWriteService {
  async writeFile(workspaceRoot: string, relativePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(workspaceRoot, relativePath);
    const docUri = vscode.Uri.file(fullPath);
    const dir = path.dirname(fullPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workEdit = new vscode.WorkspaceEdit();
    if (fs.existsSync(fullPath)) {
      const textDocument = await vscode.workspace.openTextDocument(docUri);
      const startPos = new vscode.Position(0, 0);
      const endPos = textDocument.lineAt(textDocument.lineCount - 1).range.end;
      const range = new vscode.Range(startPos, endPos);
      workEdit.replace(docUri, range, content);
    } else {
      workEdit.createFile(docUri, { overwrite: true, ignoreIfExists: false });
      workEdit.insert(docUri, new vscode.Position(0, 0), content);
    }

    const success = await vscode.workspace.applyEdit(workEdit);
    if (!success) {
      throw new Error("VS Code failed to apply WorkspaceEdit for write file.");
    }
    
    // Save document
    const textDocument = await vscode.workspace.openTextDocument(docUri);
    await textDocument.save();
  }

  async createFile(workspaceRoot: string, relativePath: string, content?: string): Promise<void> {
    await this.writeFile(workspaceRoot, relativePath, content || "");
  }

  async deleteFile(workspaceRoot: string, relativePath: string): Promise<void> {
    const fullPath = path.resolve(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found for deletion: ${relativePath}`);
    }

    const docUri = vscode.Uri.file(fullPath);
    const workEdit = new vscode.WorkspaceEdit();
    workEdit.deleteFile(docUri, { recursive: true, ignoreIfNotExists: false });
    
    const success = await vscode.workspace.applyEdit(workEdit);
    if (!success) {
      throw new Error("VS Code failed to apply WorkspaceEdit for delete file.");
    }
  }
}
