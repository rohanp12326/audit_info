import { ModelAdapter } from "./ModelAdapter";
import { ModelConfig } from "./ModelRegistry";
import { AgentModelInput, ModelStreamEvent, AgentResponse } from "../agent/AgentTypes";
import { tryRepairJson } from "../utils/jsonRepair";

export class OpenAIResponsesAdapter implements ModelAdapter {
  constructor(private config: ModelConfig, private apiKey: string) {}

  async *streamAgentResponse(input: AgentModelInput): AsyncGenerator<ModelStreamEvent, void, unknown> {
    const modelId = this.config.apiModel;
    const url = "https://api.openai.com/v1/chat/completions";

    const systemPrompt = input.systemPrompt;
    const userPrompt = buildUserMessage(input);

    const messages = [
      { role: "system", content: systemPrompt },
      ...input.conversation,
      { role: "user", content: userPrompt }
    ];

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages,
          stream: true,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: "error", error: `OpenAI API returned status ${response.status}: ${errorText}` };
        return;
      }

      if (!response.body) {
        yield { type: "error", error: "Empty response body from OpenAI API." };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) {
            continue;
          }
          if (cleanLine === "data: [DONE]") {
            continue;
          }
          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.substring(6);
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              if (delta) {
                fullText += delta;
                yield { type: "text_delta", text: delta };
              }
            } catch (err) {
              // Ignore partial JSON parse errors for stream metadata
            }
          }
        }
      }

      // Handle any remaining text in buffer
      if (buffer.trim()) {
        const cleanLine = buffer.trim();
        if (cleanLine.startsWith("data: ") && cleanLine !== "data: [DONE]") {
          const dataStr = cleanLine.substring(6);
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullText += delta;
              yield { type: "text_delta", text: delta };
            }
          } catch (err) {
            // ignore
          }
        }
      }

      // Parse the accumulated text as JSON to extract actions
      try {
        const repaired = tryRepairJson(fullText);
        const parsedResponse = JSON.parse(repaired) as AgentResponse;
        
        // Let's generate actions events
        if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
          for (const action of parsedResponse.actions) {
            // Generate a random ID for the action if not provided
            if (!action.id) {
              action.id = Math.random().toString(36).substring(2, 11);
            }
            yield { type: "action", action };
          }
        }
        yield { type: "done", parsedResponse };
      } catch (err: any) {
        yield { type: "error", error: `Failed to parse model response as JSON: ${err?.message || err}. Raw text: ${fullText}` };
      }

    } catch (error: any) {
      yield { type: "error", error: error?.message || String(error) };
    }
  }
}

export function buildUserMessage(input: AgentModelInput): string {
  const ctx = input.workspaceContext;
  let message = `USER PROMPT:\n${input.userPrompt}\n\n`;
  message += `WORKSPACE CONTEXT:\n`;
  message += `Root Path: ${ctx.rootPath}\n\n`;
  
  if (ctx.fileTree && ctx.fileTree.length > 0) {
    message += `File Tree Summary:\n${ctx.fileTree.join("\n")}\n\n`;
  }
  
  if (ctx.gitDiff) {
    message += `Git Diff:\n\`\`\`diff\n${ctx.gitDiff}\n\`\`\`\n\n`;
  }
  
  if (ctx.activeFile) {
    message += `Active File: ${ctx.activeFile.path}\n`;
    message += `Active File Content:\n\`\`\`\n${ctx.activeFile.content}\n\`\`\`\n`;
    if (ctx.activeFile.selection) {
      message += `Active Selection:\n\`\`\`\n${ctx.activeFile.selection}\n\`\`\`\n`;
    }
    message += `\n`;
  }
  
  if (ctx.openFiles && ctx.openFiles.length > 0) {
    message += `Open Files:\n`;
    for (const file of ctx.openFiles) {
      if (file.path !== ctx.activeFile?.path) {
        message += `File: ${file.path}\nContent:\n\`\`\`\n${file.content || ""}\n\`\`\`\n\n`;
      }
    }
  }

  if (ctx.relevantFiles && ctx.relevantFiles.length > 0) {
    message += `Relevant Files:\n`;
    for (const file of ctx.relevantFiles) {
      const isOpen = ctx.openFiles.some(f => f.path === file.path);
      const isActive = ctx.activeFile?.path === file.path;
      if (!isOpen && !isActive) {
        message += `File: ${file.path}\nContent:\n\`\`\`\n${file.content || ""}\n\`\`\`\n\n`;
      }
    }
  }
  
  return message;
}
