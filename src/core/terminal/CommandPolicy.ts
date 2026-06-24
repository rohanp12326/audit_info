const DANGEROUS_PATTERNS = [
  "rm -rf",
  "sudo",
  "mkfs",
  "shutdown",
  "reboot",
  "del /s",
  "format",
  ":(){ :|:& };:",
  "curl * | sh",
  "wget * | sh"
];

export class CommandPolicy {
  static getRiskLevel(command: string): "low" | "medium" | "high" {
    const trimmed = command.toLowerCase().trim();
    
    // Check for explicit dangerous commands
    for (const pattern of DANGEROUS_PATTERNS) {
      if (trimmed.includes(pattern.toLowerCase())) {
        return "high";
      }
    }

    // Check for typical write or environment modifying actions
    if (
      trimmed.includes("npm install") ||
      trimmed.includes("yarn add") ||
      trimmed.includes("pnpm add") ||
      trimmed.includes("pip install") ||
      trimmed.includes("cargo add")
    ) {
      return "medium";
    }

    return "low";
  }
}
