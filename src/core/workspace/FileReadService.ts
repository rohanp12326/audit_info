import * as fs from "fs";
import * as path from "path";

export class FileReadService {
  async readFile(workspaceRoot: string, relativePath: string): Promise<string> {
    const fullPath = path.resolve(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return fs.readFileSync(fullPath, "utf-8");
  }
}
