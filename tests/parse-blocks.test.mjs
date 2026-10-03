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

test("does not split a cell on an escaped or code-wrapped pipe", () => {
  const blocks = parseBlocks("| فرمان | نتیجه |\n|---|---|\n| `a \\| b` | ok |");
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].rows, [["`a | b`", "ok"]]);
});

test("keeps genuine empty cells between the outer pipes", () => {
  const blocks = parseBlocks("| a | b | c |\n|---|---|---|\n|  | 2 |  |");
  assert.deepEqual(blocks[0].rows, [["", "2", ""]]);
});

test("the sample text exercises every supported block type", async () => {
  const { sampleText } = await import("../app/lib/sample-text.ts");
  const types = new Set(parseBlocks(sampleText).map((block) => block.type));
  for (const type of ["heading", "paragraph", "list", "quote", "table", "code"]) {
    assert.ok(types.has(type), `sample text no longer covers ${type} blocks`);
  }
});

test("the sample text keeps its pipes-without-delimiter row as plain text", async () => {
  const { sampleText } = await import("../app/lib/sample-text.ts");
  const plain = parseBlocks(sampleText).find(
    (block) => block.type === "paragraph" && block.content.includes("| متن ساده با خط لوله است |"),
  );
  assert.ok(plain, "expected the non-table pipe row to stay a paragraph");
});

test("parses indented code blocks and strips relative indentation", () => {
  const input = [
    "  ```yaml",
    "  watchtower:",
    "    image: containrrr/watchtower",
    "    restart: always",
    "    volumes:",
    "      - /var/run/docker.sock:/var/run/docker.sock",
    "",
    "    command: --interval 300 khana-app",
    "  ```",
  ].join("\n");

  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].language, "yaml");
  assert.equal(
    blocks[0].content,
    [
      "watchtower:",
      "  image: containrrr/watchtower",
      "  restart: always",
      "  volumes:",
      "    - /var/run/docker.sock:/var/run/docker.sock",
      "",
      "  command: --interval 300 khana-app",
    ].join("\n"),
  );
});

test("parses code blocks preceded by invisible bidi control characters", () => {
  const input = "\u200E```yaml\nwatchtower:\n  image: containrrr/watchtower\n\u200F```";
  const blocks = parseBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "code");
  assert.equal(blocks[0].language, "yaml");
  assert.equal(blocks[0].content, "watchtower:\n  image: containrrr/watchtower");
});

test("parses code blocks fenced with tildes", () => {
  const input = "~~~python\nprint('hello')\n~~~";
  const blocks = parseBlocks(input);
  assert.deepEqual(blocks, [{ type: "code", content: "print('hello')", language: "python" }]);
});

test("parses code blocks with more than 3 backticks and preserves inner backticks", () => {
  const input = "````markdown\n```js\nconst x = 1;\n```\n````";
  const blocks = parseBlocks(input);
  assert.deepEqual(blocks, [
    { type: "code", content: "```js\nconst x = 1;\n```", language: "markdown" },
  ]);
});

test("parses headings, lists, quotes, and tables preceded by bidi control characters", () => {
  const heading = parseBlocks("\u200F# عنوان فارسی");
  assert.deepEqual(heading, [{ type: "heading", level: 1, content: "عنوان فارسی" }]);

  const list = parseBlocks("\u200E- آیتم یک\n\u200E- آیتم دو");
  assert.deepEqual(list, [{ type: "list", items: ["آیتم یک", "آیتم دو"], ordered: false }]);

  const quote = parseBlocks("\u200F> متن نقل‌قول");
  assert.deepEqual(quote, [{ type: "quote", content: "متن نقل‌قول" }]);

  const table = parseBlocks("\u200F| سرستون |\n\u200F|---|\n\u200F| داده |");
  assert.equal(table[0].type, "table");
  assert.deepEqual(table[0].header, ["سرستون"]);
  assert.deepEqual(table[0].rows, [["داده"]]);
});

