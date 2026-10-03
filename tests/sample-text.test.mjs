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

test("sample text includes a heading that starts with a number", () => {
  const headings = parseBlocks(sampleText)
    .filter((block) => block.type === "heading")
    .map((block) => block.content);

  // Digits carry no strong bidi type, so the letter after them must still win.
  assert.ok(
    headings.some((content) => /^[۰-۹0-9]/.test(content)),
    "expected a heading beginning with a digit",
  );
});

test("sample text mixes English and Persian inside one ordered list", async () => {
  const { getTextDirection } = await import("../app/lib/direction.ts");
  const mixed = parseBlocks(sampleText)
    .filter((block) => block.type === "list" && block.ordered)
    .find((list) => list.items.some((item) => getTextDirection(item) === "ltr"));

  assert.ok(mixed, "expected an ordered list containing English items");
  // English items stay LTR while a Persian item in the same list stays RTL.
  assert.ok(mixed.items.some((item) => getTextDirection(item) === "rtl"));
});

test("sample text includes an indented YAML code block", () => {
  const blocks = parseBlocks(sampleText);
  const yamlBlock = blocks.find(
    (block) => block.type === "code" && block.language === "yaml",
  );

  assert.ok(yamlBlock, "expected an indented YAML code block in sample text");
  assert.match(yamlBlock.content, /watchtower:/);
  assert.match(yamlBlock.content, /- \/var\/run\/docker\.sock/);
});

