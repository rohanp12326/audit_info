import { ModelAdapter } from "./ModelAdapter";
import { ModelConfig } from "./ModelRegistry";
import { AgentModelInput, ModelStreamEvent, AgentResponse } from "../agent/AgentTypes";
import { tryRepairJson } from "../utils/jsonRepair";
import { buildUserMessage } from "./OpenAIResponsesAdapter";

export class ZaiGlmAdapter implements ModelAdapter {
  constructor(_config: ModelConfig, private apiKey: string) {}

  async *streamAgentResponse(input: AgentModelInput): AsyncGenerator<ModelStreamEvent, void, unknown> {
    const url = "https://api.z.ai/api/paas/v4/chat/completions";

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
          model: "glm-4.7",
          stream: true,
          temperature: 0.6,
          max_tokens: 8192,
          thinking: {
            type: "enabled"
          },
          messages: messages
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield { type: "error", error: `GLM API returned status ${response.status}: ${errorText}` };
        return;
      }

      if (!response.body) {
        yield { type: "error", error: "Empty response body from GLM API." };
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
              // Extract either standard delta content or GLM specific fields (if any)
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
        
        if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
          for (const action of parsedResponse.actions) {
            if (!action.id) {
              action.id = Math.random().toString(36).substring(2, 11);
            }
            yield { type: "action", action };
          }
        }
        yield { type: "done", parsedResponse };
      } catch (err: any) {
        yield { type: "error", error: `Failed to parse GLM response as JSON: ${err?.message || err}. Raw text: ${fullText}` };
      }

    } catch (error: any) {
      yield { type: "error", error: error?.message || String(error) };
    }
  }
}
