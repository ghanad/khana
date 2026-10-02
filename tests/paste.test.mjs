import assert from "node:assert/strict";
import test from "node:test";

import { planPaste } from "../app/lib/paste.ts";

test("leaves an empty clipboard to the browser", () => {
  assert.deepEqual(planPaste(""), { action: "ignore" });
  assert.deepEqual(planPaste("   \n "), { action: "ignore" });
});

test("always replaces the document rather than deferring to the browser", () => {
  // Regression: the input panel collapses on paste, which unmounts the textarea.
  // A native paste runs after the handler returns, so when the browser owned the
  // insertion the text landed in a detached node and silently vanished.
  assert.deepEqual(planPaste("متن جدید"), {
    action: "replace",
    text: "متن جدید",
  });
});

test("keeps the pasted text verbatim, without trimming", () => {
  const pasted = "  خط اول\n\nخط دوم  ";
  const plan = planPaste(pasted);
  assert.equal(plan.text, pasted);
});
