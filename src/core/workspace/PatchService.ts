import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export class PatchService {
  /**
   * Applies a unified diff to the original content of a file.
   */
  applyPatch(originalContent: string, unifiedDiff: string): string {
    const lines = originalContent.split(/\r?\n/);
    const diffLines = unifiedDiff.split(/\r?\n/);
    
    let currentLineOffset = 0;
    let i = 0;
    
    // Skip header lines until we find the first hunk
    while (i < diffLines.length && !diffLines[i].startsWith("@@")) {
      i++;
    }
    
    if (i >= diffLines.length) {
      // No hunk found, maybe the diff is simple search-and-replace or contains raw changes.
      // Let's try to parse if there's any + or - changes.
      throw new Error("No unified diff hunk headers (@@ -start,len +start,len @@) found in patch.");
    }
    
    while (i < diffLines.length) {
      if (diffLines[i].startsWith("@@")) {
        const header = diffLines[i];
        // Parse: @@ -oldStart,oldLen +newStart,newLen @@
        const match = header.match(/@@\s*-(\d+),?(\d+)?\s*\+(\d+),?(\d+)?\s*@@/);
        if (!match) {
          throw new Error(`Invalid hunk header: ${header}`);
        }
        
        const oldStart = parseInt(match[1], 10) - 1; // 0-indexed
        
        i++; // Move past @@ header
        
        const expectedOldLines: string[] = [];
        const replacementLines: string[] = [];
        
        while (i < diffLines.length && !diffLines[i].startsWith("@@")) {
          const diffLine = diffLines[i];
          if (diffLine.startsWith("-")) {
            expectedOldLines.push(diffLine.substring(1));
          } else if (diffLine.startsWith("+")) {
            replacementLines.push(diffLine.substring(1));
          } else if (diffLine.startsWith(" ")) {
            expectedOldLines.push(diffLine.substring(1));
            replacementLines.push(diffLine.substring(1));
          } else {
            // Treat empty line or any other line as context (or skip if it is a diff indicator)
            if (diffLine === "") {
              expectedOldLines.push("");
              replacementLines.push("");
            }
          }
          i++;
        }
        
        // Find matching position in the original file lines
        // We look around (oldStart + currentLineOffset) first
        let targetIndex = oldStart + currentLineOffset;
        let found = false;
        
        // Simple search around targetIndex
        const maxOffset = Math.max(50, lines.length);
        for (let offset = 0; offset < maxOffset; offset++) {
          // Try +offset
          if (targetIndex + offset <= lines.length - expectedOldLines.length) {
            if (this.matchLines(lines, targetIndex + offset, expectedOldLines)) {
              targetIndex = targetIndex + offset;
              found = true;
              break;
            }
          }
          // Try -offset
          if (offset > 0 && targetIndex - offset >= 0) {
            if (this.matchLines(lines, targetIndex - offset, expectedOldLines)) {
              targetIndex = targetIndex - offset;
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          throw new Error(
            `Could not apply hunk at line ${oldStart + 1}. Context mismatch.\nExpected:\n${expectedOldLines.join("\n")}`
          );
        }
        
        // Replace expectedOldLines with replacementLines at targetIndex
        lines.splice(targetIndex, expectedOldLines.length, ...replacementLines);
        
        // Update offset for subsequent hunks
        currentLineOffset += (replacementLines.length - expectedOldLines.length);
      } else {
        i++;
      }
    }
    
    return lines.join("\n");
  }
  
  private matchLines(fileLines: string[], startIndex: number, expectedLines: string[]): boolean {
    if (startIndex + expectedLines.length > fileLines.length) {
      return false;
    }
    for (let i = 0; i < expectedLines.length; i++) {
      if (fileLines[startIndex + i].trim() !== expectedLines[i].trim()) {
        return false;
      }
    }
    return true;
  }

  /**
   * Applies changes to disk using VS Code WorkspaceEdit.
   */
  async applyFilePatch(workspaceRoot: string, relativePath: string, unifiedDiff: string): Promise<string> {
    const fullPath = path.resolve(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const currentContent = fs.readFileSync(fullPath, "utf-8");
    const newContent = this.applyPatch(currentContent, unifiedDiff);

    const docUri = vscode.Uri.file(fullPath);
    const workEdit = new vscode.WorkspaceEdit();
    
    // Read total document range
    const textDocument = await vscode.workspace.openTextDocument(docUri);
    const startPos = new vscode.Position(0, 0);
    const endPos = textDocument.lineAt(textDocument.lineCount - 1).range.end;
    const range = new vscode.Range(startPos, endPos);
    
    workEdit.replace(docUri, range, newContent);
    const success = await vscode.workspace.applyEdit(workEdit);
    if (!success) {
      throw new Error("VS Code failed to apply WorkspaceEdit.");
    }
    
    // Save document
    await textDocument.save();
    return relativePath;
  }
}
