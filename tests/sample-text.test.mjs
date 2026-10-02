import assert from "node:assert/strict";
import test from "node:test";

import { parseBlocks } from "../app/lib/parse-blocks.ts";
import { sampleText } from "../app/lib/sample-text.ts";

test("ships sample text that contains both Persian and English", () => {
  assert.match(sampleText, /می‌تواند/);
  assert.match(sampleText, /Clear writing/);
});

test("sample text parses into readable blocks", () => {
  const blocks = parseBlocks(sampleText);
  const types = new Set(blocks.map((block) => block.type));

  assert.ok(types.has("paragraph"));
  assert.ok(types.has("code"));
});

test("sample code fence survives intact, nested template literal included", () => {
  const blocks = parseBlocks(sampleText);
  const code = blocks.find((block) => block.type === "code");

  assert.ok(code, "expected a code block in the sample text");
  assert.equal(code.language, "javascript");
  assert.match(code.content, /const message = `سلام، \$\{name\}!`;/);
  assert.match(code.content, /console\.log\(greet\("خوانا"\)\);/);
});
