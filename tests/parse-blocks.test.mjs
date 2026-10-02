import assert from "node:assert/strict";
import test from "node:test";

import { parseBlocks } from "../app/lib/parse-blocks.ts";

test("parses paragraphs and skips blank lines", () => {
  const blocks = parseBlocks("first\n\nsecond");
  assert.deepEqual(blocks, [
    { type: "paragraph", content: "first" },
    { type: "paragraph", content: "second" },
  ]);
});

test("keeps soft line breaks inside a paragraph", () => {
  const blocks = parseBlocks("line one\nline two");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].content, "line one\nline two");
});

test("parses fenced code blocks with a language label", () => {
  const blocks = parseBlocks("```js\nconst a = 1;\n```");
  assert.deepEqual(blocks, [{ type: "code", content: "const a = 1;", language: "js" }]);
});

test("keeps markdown syntax inside code blocks verbatim", () => {
  const blocks = parseBlocks("```\n- not a list\n# not a heading\n```");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].content, "- not a list\n# not a heading");
});

test("parses headings and shifts their level", () => {
  const blocks = parseBlocks("# عنوان\n### زیرعنوان");
  assert.deepEqual(blocks, [
    { type: "heading", content: "عنوان", level: 1 },
    { type: "heading", content: "زیرعنوان", level: 3 },
  ]);
});

test("parses unordered and ordered lists", () => {
  const blocks = parseBlocks("- یک\n- دو\n\n1. اول\n2. دوم");
  assert.deepEqual(blocks[0], { type: "list", items: ["یک", "دو"], ordered: false });
  assert.deepEqual(blocks[1], { type: "list", items: ["اول", "دوم"], ordered: true });
});

test("parses block quotes", () => {
  const blocks = parseBlocks("> first\n> second");
  assert.deepEqual(blocks, [{ type: "quote", content: "first second" }]);
});

test("returns no blocks for empty or whitespace-only input", () => {
  assert.deepEqual(parseBlocks(""), []);
  assert.deepEqual(parseBlocks("   \n\n  "), []);
});

test("normalizes CRLF line endings", () => {
  assert.deepEqual(parseBlocks("a\r\nb"), [{ type: "paragraph", content: "a\nb" }]);
});

test("parses a pipe table with a header and rows", () => {
  const blocks = parseBlocks(
    "| Job | زمان |\n|---|---|\n| Lint | 42s |\n| Build | 2m |",
  );
  assert.deepEqual(blocks, [
    {
      type: "table",
      header: ["Job", "زمان"],
      rows: [
        ["Lint", "42s"],
        ["Build", "2m"],
      ],
      align: [null, null],
    },
  ]);
});

test("parses tables without outer pipes and reads cell alignment", () => {
  const blocks = parseBlocks("a | b | c\n:-- | :-: | --:\n1 | 2 | 3");
  assert.deepEqual(blocks, [
    {
      type: "table",
      header: ["a", "b", "c"],
      rows: [["1", "2", "3"]],
      align: ["left", "center", "right"],
    },
  ]);
});

test("pads short rows and drops extra cells to the header width", () => {
  const blocks = parseBlocks("| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |");
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].rows, [
    ["1", ""],
    ["1", "2"],
  ]);
});

test("keeps pipes as plain text when no delimiter row follows", () => {
  assert.deepEqual(parseBlocks("| a | b |\nnot a delimiter"), [
    { type: "paragraph", content: "| a | b |\nnot a delimiter" },
  ]);
});

test("stops a paragraph before a following table", () => {
  const blocks = parseBlocks("intro line\n| a | b |\n|---|---|\n| 1 | 2 |");
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[0].content, "intro line");
  assert.equal(blocks[1].type, "table");
});

test("keeps table syntax verbatim inside code blocks", () => {
  const blocks = parseBlocks("```\n| a | b |\n|---|---|\n```");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].content, "| a | b |\n|---|---|");
});
