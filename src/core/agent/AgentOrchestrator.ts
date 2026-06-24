import { ModelRegistry } from "../models/ModelRegistry";
import { WorkspaceContextService } from "../workspace/WorkspaceContextService";
import { PatchService } from "../workspace/PatchService";
import { FileReadService } from "../workspace/FileReadService";
import { FileWriteService } from "../workspace/FileWriteService";
import { CommandExecutionService } from "../terminal/CommandExecutionService";
import { ChatMessage, AgentAction, AgentActionResult, AgentResponse } from "./AgentTypes";
import { AgentPromptBuilder } from "./AgentPromptBuilder";
import { AgentActionParser } from "./AgentActionParser";
import { CommandPolicy } from "../terminal/CommandPolicy";
import { Logger } from "../utils/logger";

const MAX_AGENT_ITERATIONS = 8;

class AssistantMessageExtractor {
  private valueStartIndex = -1;
  private valueEndIndex = -1;
  private lastEmittedIndex = 0;
  private completeMessage = "";

  public feed(accumulatedText: string): string {
    if (this.valueStartIndex === -1) {
      const match = accumulatedText.match(/"assistantMessage"\s*:\s*"/);
      if (match && match.index !== undefined) {
        this.valueStartIndex = match.index + match[0].length;
        this.lastEmittedIndex = this.valueStartIndex;
      } else {
        return "";
      }
    }

    if (this.valueEndIndex !== -1) {
      return "";
    }

    let i = this.lastEmittedIndex;
    let delta = "";
    
    // Check if the accumulated text ends with an uncompleted escape sequence
    let limit = accumulatedText.length;
    if (accumulatedText.endsWith("\\")) {
      let backslashCount = 0;
      let idx = accumulatedText.length - 1;
      while (idx >= 0 && accumulatedText[idx] === "\\") {
        backslashCount++;
        idx--;
      }
      if (backslashCount % 2 !== 0) {
        limit--;
      }
    }
    
    while (i < limit) {
      const char = accumulatedText[i];
      if (char === '"' && accumulatedText[i - 1] !== '\\') {
        this.valueEndIndex = i;
        break;
      }
      delta += char;
      i++;
    }

    this.lastEmittedIndex = i;
    const cleanDelta = this.unescapeString(delta);
    this.completeMessage += cleanDelta;
    return cleanDelta;
  }

  public getCompleteMessage(): string {
    return this.completeMessage;
  }

  private unescapeString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

export class AgentOrchestrator {
  private fileReadService = new FileReadService();
  private fileWriteService = new FileWriteService();
  private pendingApprovals: Map<string, (approved: boolean) => void> = new Map();
  private isRunning = false;

  constructor(
    private modelRegistry: ModelRegistry,
    private workspaceContext: WorkspaceContextService,
    private patchService: PatchService,
    private commandService: CommandExecutionService
  ) {}

  public approveAction(actionId: string) {
    const resolve = this.pendingApprovals.get(actionId);
    if (resolve) {
      resolve(true);
    }
  }

  public rejectAction(actionId: string) {
    const resolve = this.pendingApprovals.get(actionId);
    if (resolve) {
      resolve(false);
    }
  }

  public cancelAll() {
    this.isRunning = false;
    for (const [, resolve] of this.pendingApprovals.entries()) {
      resolve(false);
    }
    this.pendingApprovals.clear();
  }

  async run(
    modelId: string,
    userPrompt: string,
    conversation: ChatMessage[],
    callbacks: {
      onTextDelta: (text: string) => void;
      onMessageComplete: (text: string) => void;
      onActionPreview: (action: AgentAction) => void;
      onActionResult: (result: AgentActionResult) => void;
      onCommandOutput: (chunk: string) => void;
      onError: (message: string) => void;
    },
    requireFileEditApproval: boolean,
    requireCommandApproval: boolean,
    isGovernanceCheck?: boolean
  ): Promise<void> {
    if (this.isRunning) {
      callbacks.onError("Another agent execution loop is already running.");
      return;
    }

    this.isRunning = true;
    let iteration = 0;
    
    // In-memory conversation history copy for the agent loop
    const internalConversation = [...conversation];

    try {
      while (this.isRunning && iteration < MAX_AGENT_ITERATIONS) {
        Logger.info(`Agent loop iteration ${iteration + 1}/${MAX_AGENT_ITERATIONS}`);

        const workspaceRoot = this.workspaceContext.getRootPath();
        if (!workspaceRoot) {
          callbacks.onError("No active workspace folder open. Open a workspace folder to use Vibe Coder.");
          break;
        }

        // 1. Gather Workspace Context
        const context = await this.workspaceContext.getContext();

        // 2. Build System Prompt
        const systemPrompt = isGovernanceCheck
          ? AgentPromptBuilder.buildGovernanceSystemPrompt()
          : AgentPromptBuilder.buildSystemPrompt();

        // 3. Get Adapter for Model
        const adapter = await this.modelRegistry.getAdapter(modelId);

        // 4. Call Model Stream
        const stream = adapter.streamAgentResponse({
          model: modelId,
          apiKey: "", // Adapter retrieves its own key from SecretManager
          systemPrompt,
          userPrompt: iteration === 0 ? userPrompt : "Please inspect the results of the previous actions and decide on the next step.",
          workspaceContext: context,
          conversation: internalConversation
        });

        let assistantTextAccumulator = "";
        let actionsToRun: AgentAction[] = [];
        let nextStep: AgentResponse["nextStep"] = "done";
        let hasError = false;
        let finalParsedResponse: AgentResponse | undefined;

        const messageExtractor = new AssistantMessageExtractor();

        for await (const event of stream) {
          if (!this.isRunning) {
            break;
          }

          if (event.type === "text_delta") {
            assistantTextAccumulator += event.text;
            const delta = messageExtractor.feed(assistantTextAccumulator);
            if (delta) {
              callbacks.onTextDelta(delta);
            }
          } else if (event.type === "action") {
            // Clean/sanitize action
            const sanitized = AgentActionParser.parseActions([event.action], workspaceRoot)[0];
            if (sanitized) {
              actionsToRun.push(sanitized);
            }
          } else if (event.type === "done") {
            if (event.parsedResponse) {
              finalParsedResponse = event.parsedResponse;
              nextStep = event.parsedResponse.nextStep;
              // Clean all parsed actions if they were returned as a bulk block in done
              if (event.parsedResponse.actions && actionsToRun.length === 0) {
                actionsToRun = AgentActionParser.parseActions(event.parsedResponse.actions, workspaceRoot);
              }
            }
          } else if (event.type === "error") {
            callbacks.onError(event.error);
            hasError = true;
            break;
          }
        }

        if (hasError || !this.isRunning) {
          break;
        }

        const finalCleanMessage = finalParsedResponse?.assistantMessage || 
                                  messageExtractor.getCompleteMessage() || 
                                  assistantTextAccumulator;

        callbacks.onMessageComplete(finalCleanMessage);

        // Record the assistant's explanation message in the history
        internalConversation.push({
          role: "assistant",
          content: finalCleanMessage
        });

        if (isGovernanceCheck) {
          actionsToRun = [];
          nextStep = "done";
        }

        // 5. Execute proposed actions
        const actionResults: AgentActionResult[] = [];
        
        for (const action of actionsToRun) {
          if (!this.isRunning) {
            break;
          }

          // Check if approval is needed
          let approvalRequired = false;
          if (action.type === "run_command") {
            // Check policy: if command is high-risk, force approval anyway. Otherwise respect settings.
            const risk = CommandPolicy.getRiskLevel(action.command);
            action.riskLevel = risk;
            approvalRequired = requireCommandApproval || (risk === "high");
          } else if (
            action.type === "write_file" ||
            action.type === "patch_file" ||
            action.type === "create_file" ||
            action.type === "delete_file"
          ) {
            approvalRequired = requireFileEditApproval;
          }

          let approved = true;
          if (approvalRequired) {
            callbacks.onActionPreview(action);
            approved = await new Promise<boolean>((resolve) => {
              this.pendingApprovals.set(action.id, resolve);
            });
            this.pendingApprovals.delete(action.id);
          }

          if (!approved) {
            const result: AgentActionResult = {
              actionId: action.id,
              type: action.type,
              success: false,
              error: "Action was rejected by the user."
            };
            actionResults.push(result);
            callbacks.onActionResult(result);
            continue;
          }

          // Execute action
          try {
            let output = "";
            switch (action.type) {
              case "read_file":
                output = await this.fileReadService.readFile(workspaceRoot, action.path);
                break;
                
              case "write_file":
                await this.fileWriteService.writeFile(workspaceRoot, action.path, action.content);
                output = `File written successfully.`;
                break;
                
              case "create_file":
                await this.fileWriteService.createFile(workspaceRoot, action.path, action.content);
                output = `File created successfully.`;
                break;
                
              case "delete_file":
                await this.fileWriteService.deleteFile(workspaceRoot, action.path);
                output = `File deleted successfully.`;
                break;
                
              case "patch_file":
                await this.patchService.applyFilePatch(workspaceRoot, action.path, action.unifiedDiff);
                output = `Patch applied successfully.`;
                break;
                
              case "run_command":
                callbacks.onCommandOutput(`\n> Running command: ${action.command}\n`);
                const cmdRes = await this.commandService.executeCommand(
                  action.command,
                  workspaceRoot,
                  (chunk) => callbacks.onCommandOutput(chunk)
                );
                output = `Exit code: ${cmdRes.exitCode}\nOutput:\n${cmdRes.output}`;
                break;
            }

            const result: AgentActionResult = {
              actionId: action.id,
              type: action.type,
              success: true,
              output
            };
            actionResults.push(result);
            callbacks.onActionResult(result);
          } catch (err: any) {
            const errorMsg = err?.message || String(err);
            const result: AgentActionResult = {
              actionId: action.id,
              type: action.type,
              success: false,
              error: errorMsg
            };
            actionResults.push(result);
            callbacks.onActionResult(result);
            Logger.error(`Action execution failed: ${action.type}`, err);
          }
        }

        // Format action outcomes for the model's next turn
        if (actionResults.length > 0) {
          const resultsSummary = actionResults.map(res => {
            const status = res.success ? "Success" : "Failed";
            const detail = res.success ? (res.output || "") : (res.error || "");
            return `Action ID: ${res.actionId} (${res.type}) -> ${status}\nDetail:\n${detail}\n---`;
          }).join("\n");

          internalConversation.push({
            role: "system",
            content: `The user/system executed the actions. Here are the outcomes:\n\n${resultsSummary}`
          });
        }

        // If nextStep is done or await_user, or no actions were proposed, break the loop
        if (nextStep === "done" || nextStep === "await_user" || actionsToRun.length === 0) {
          break;
        }

        iteration++;
      }
    } catch (err: any) {
      callbacks.onError(`Orchestrator error: ${err?.message || err}`);
      Logger.error("Orchestrator loop error", err);
    } finally {
      this.isRunning = false;
    }
  }
}
