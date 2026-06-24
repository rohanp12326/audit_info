import { AgentModelInput, ModelStreamEvent } from "../agent/AgentTypes";

export interface ModelAdapter {
  streamAgentResponse(input: AgentModelInput): AsyncGenerator<ModelStreamEvent, void, unknown>;
}
