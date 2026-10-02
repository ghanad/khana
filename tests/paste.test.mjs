import assert from "node:assert/strict";
import test from "node:test";

import { planPaste } from "../app/lib/paste.ts";

test("ignores pastes with no meaningful text", () => {
  assert.deepEqual(planPaste("", "متن قبلی", 3, 3), { action: "ignore" });
  assert.deepEqual(planPaste("   \n ", "متن قبلی", 3, 3), { action: "ignore" });
});

test("leaves an empty field to the native paste", () => {
  assert.deepEqual(planPaste("متن جدید", "", 0, 0), { action: "default" });
  assert.deepEqual(planPaste("متن جدید", "   ", 0, 0), { action: "default" });
});

test("leaves a full-document selection to the native paste", () => {
  assert.deepEqual(planPaste("متن جدید", "متن قبلی", 0, "متن قبلی".length), {
    action: "default",
  });
});

test("replaces instead of appending when the caret sits in existing text", () => {
  assert.deepEqual(planPaste("متن جدید", "متن قبلی", 4, 4), {
    action: "replace",
    text: "متن جدید",
  });
  assert.deepEqual(planPaste("متن جدید", "متن قبلی", 0, 0), {
    action: "replace",
    text: "متن جدید",
  });
  assert.deepEqual(planPaste("متن جدید", "متن قبلی", "متن قبلی".length, "متن قبلی".length), {
    action: "replace",
    text: "متن جدید",
  });
});

test("replaces when only part of the text is selected", () => {
  assert.deepEqual(planPaste("متن جدید", "متن قبلی", 2, 5), {
    action: "replace",
    text: "متن جدید",
  });
});

test("keeps the pasted text verbatim, without trimming", () => {
  const pasted = "  خط اول\n\nخط دوم  ";
  const plan = planPaste(pasted, "متن قبلی", 4, 4);
  assert.equal(plan.text, pasted);
});
