import * as assert from "assert";
import { PatchService } from "../core/workspace/PatchService";

describe("PatchService Unit Tests", () => {
  let patchService: PatchService;

  beforeEach(() => {
    patchService = new PatchService();
  });

  it("should apply a simple one-line patch correctly", () => {
    const originalContent = "line 1\nline 2\nline 3\nline 4";
    const unifiedDiff = `--- a/file.txt
+++ b/file.txt
@@ -2,2 +2,2 @@
 line 2
-line 3
+line three`;

    const result = patchService.applyPatch(originalContent, unifiedDiff);
    const expected = "line 1\nline 2\nline three\nline 4";
    assert.strictEqual(result.trim(), expected.trim());
  });

  it("should apply multi-line deletions and insertions", () => {
    const originalContent = "one\ntwo\nthree\nfour\nfive";
    const unifiedDiff = `--- a/file.txt
+++ b/file.txt
@@ -2,3 +2,3 @@
-two
-three
+two-new
+three-new
 four`;

    const result = patchService.applyPatch(originalContent, unifiedDiff);
    const expected = "one\ntwo-new\nthree-new\nfour\nfive";
    assert.strictEqual(result.trim(), expected.trim());
  });
});
