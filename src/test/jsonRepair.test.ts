import * as assert from "assert";
import { tryRepairJson } from "../core/utils/jsonRepair";

describe("jsonRepair Unit Tests", () => {
  it("should extract and parse the first balanced JSON object from duplicate blocks", () => {
    const rawInput = `{"assistantMessage":"I'll inspect styles.css","actions":[],"nextStep":"continue"}
{"assistantMessage":"I'll inspect styles.css","actions":[],"nextStep":"continue"}`;

    const result = tryRepairJson(rawInput);
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.assistantMessage, "I'll inspect styles.css");
    assert.deepStrictEqual(parsed.actions, []);
    assert.strictEqual(parsed.nextStep, "continue");
  });

  it("should ignore trailing markdown text after the JSON object", () => {
    const rawInput = `{"assistantMessage":"Done!","actions":[],"nextStep":"done"} Hope this helps!`;
    const result = tryRepairJson(rawInput);
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.assistantMessage, "Done!");
  });

  it("should escape raw control characters in string literals", () => {
    const rawInput = `{"assistantMessage":"Line 1\nLine 2\tTabbed","actions":[],"nextStep":"done"}`;
    const result = tryRepairJson(rawInput);
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.assistantMessage, "Line 1\nLine 2\tTabbed");
  });
});
