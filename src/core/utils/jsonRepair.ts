export function tryRepairJson(input: string): string {
  let cleaned = input.trim();
  
  // Strip markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    cleaned = cleaned.trim();
  }
  
  // Try to extract the first balanced JSON object {...}
  cleaned = extractFirstBalancedObject(cleaned);

  // Escape unescaped control characters in JSON string values
  cleaned = escapeControlCharsInJsonStrings(cleaned);

  // Let's try parsing. If it fails, let's try some simple heuristics.
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    // Basic repair attempt: balancing brackets or quotes
    // (A full parser isn't necessary, but let's do a few simple repairs)
    
    // Fix trailing comma before a closing bracket/brace
    cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
    
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (innerErr) {
      // Just return the cleaned string and let JSON.parse fail in the parser with clear context
      return cleaned;
    }
  }
}

export function escapeControlCharsInJsonStrings(str: string): string {
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (escape) {
        result += char;
        escape = false;
        continue;
      }

      if (char === "\\") {
        result += char;
        escape = true;
        continue;
      }

      if (char === '"') {
        result += char;
        inString = false;
        continue;
      }

      // Check for raw control characters inside string literal
      if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        const code = char.charCodeAt(0);
        if (code < 32) {
          result += "\\u" + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result;
}

export function extractFirstBalancedObject(str: string): string {
  const firstBrace = str.indexOf("{");
  if (firstBrace === -1) {
    return str;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return str.substring(firstBrace, i + 1);
        }
      }
    }
  }

  return str;
}
