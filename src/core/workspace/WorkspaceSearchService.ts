import * as vscode from "vscode";

export class WorkspaceSearchService {
  async searchFiles(globPattern: string, maxResults = 100): Promise<string[]> {
    const uris = await vscode.workspace.findFiles(globPattern, "**/node_modules/**", maxResults);
    return uris.map(uri => vscode.workspace.asRelativePath(uri));
  }
}
