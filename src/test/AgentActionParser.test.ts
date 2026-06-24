import * as assert from "assert";
import { AgentActionParser } from "../core/agent/AgentActionParser";

describe("AgentActionParser Unit Tests", () => {
  const workspaceRoot = "/workspace";

  it("should parse a valid read_file action and normalize the path", () => {
    const rawActions = [
      {
        type: "read_file",
        path: "../outside/file.txt"
      }
    ];

    const parsed = AgentActionParser.parseActions(rawActions, workspaceRoot);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, "read_file");
    // Path should be normalized. Since it went out of workspace, let's make sure it's correct.
    // path.normalize("../outside/file.txt") -> "../outside/file.txt"
    assert.ok(parsed[0].path.includes("outside"));
  });

  it("should parse a run_command action and default to low risk if not matched", () => {
    const rawActions = [
      {
        type: "run_command",
        command: "npm test",
        summary: "Run tests"
      }
    ];

    const parsed = AgentActionParser.parseActions(rawActions, workspaceRoot);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].type, "run_command");
    if (parsed[0].type === "run_command") {
      assert.strictEqual(parsed[0].command, "npm test");
      assert.strictEqual(parsed[0].riskLevel, "low");
    }
  });
});
