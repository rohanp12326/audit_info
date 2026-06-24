import * as path from "path";
import { AgentAction } from "./AgentTypes";

export class AgentActionParser {
  static parseActions(actions: any[], workspaceRoot: string): AgentAction[] {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions.map((act) => {
      const id = act.id || Math.random().toString(36).substring(2, 11);
      const type = act.type;
      
      // Clean and sanitize file path if present
      let filePath = act.path ? String(act.path) : "";
      if (filePath) {
        // Prevent directory traversal or absolute paths pointing outside workspace
        filePath = path.normalize(filePath);
        if (path.isAbsolute(filePath)) {
          filePath = path.relative(workspaceRoot, filePath);
        }
        filePath = filePath.replace(/\\/g, "/"); // normalize separator
      }

      switch (type) {
        case "read_file":
          return {
            id,
            type: "read_file",
            path: filePath
          };
        case "write_file":
          return {
            id,
            type: "write_file",
            path: filePath,
            summary: act.summary || `Write to ${filePath}`,
            content: act.content || ""
          };
        case "patch_file":
          return {
            id,
            type: "patch_file",
            path: filePath,
            summary: act.summary || `Patch ${filePath}`,
            unifiedDiff: act.unifiedDiff || ""
          };
        case "create_file":
          return {
            id,
            type: "create_file",
            path: filePath,
            summary: act.summary || `Create ${filePath}`,
            content: act.content || ""
          };
        case "delete_file":
          return {
            id,
            type: "delete_file",
            path: filePath,
            summary: act.summary || `Delete ${filePath}`
          };
        case "run_command":
          return {
            id,
            type: "run_command",
            command: act.command || "",
            cwd: act.cwd || ".",
            summary: act.summary || `Run command ${act.command}`,
            riskLevel: act.riskLevel || "low"
          };
        default:
          throw new Error(`Unsupported action type: ${type}`);
      }
    });
  }
}
