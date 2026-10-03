import assert from "node:assert/strict";
import test from "node:test";

import { getBlockLineRanges, parseBlocks } from "../app/lib/parse-blocks.ts";
import {
  computeScrollAnchors,
  getSynchronizedScrollForTextarea,
  getSynchronizedTextareaScroll,
  interpolateScroll,
} from "../app/lib/sync-scroll.ts";

test("getBlockLineRanges returns matching count with parseBlocks", () => {
  const markdown = `# Title

First paragraph with some text.
Second line of first paragraph.

- List item 1
- List item 2

> Quote line 1
> Quote line 2

\`\`\`js
console.log("hello");
\`\`\`

| A | B |
|---|---|
| 1 | 2 |
`;

  const blocks = parseBlocks(markdown);
  const ranges = getBlockLineRanges(markdown);

  assert.equal(blocks.length, ranges.length);
  assert.equal(ranges.length, 6);

  // Block 0: heading # Title -> line 0
  assert.equal(ranges[0].startLine, 0);
  assert.equal(ranges[0].endLine, 0);

  // Block 1: paragraph -> starts line 2, ends line 3
  assert.equal(ranges[1].startLine, 2);
  assert.equal(ranges[1].endLine, 3);

  // Block 2: list -> starts line 5, ends line 6
  assert.equal(ranges[2].startLine, 5);
  assert.equal(ranges[2].endLine, 6);

  // Block 3: quote -> starts line 8, ends line 9
  assert.equal(ranges[3].startLine, 8);
  assert.equal(ranges[3].endLine, 9);

  // Block 4: code block -> starts line 11, ends line 13
  assert.equal(ranges[4].startLine, 11);
  assert.equal(ranges[4].endLine, 13);

  // Block 5: table -> starts line 15, ends line 17
  assert.equal(ranges[5].startLine, 15);
  assert.equal(ranges[5].endLine, 17);
});

test("getBlockLineRanges handles empty and whitespace input", () => {
  assert.deepEqual(getBlockLineRanges(""), []);
  assert.deepEqual(getBlockLineRanges("   \n\n   \n"), []);
});

test("interpolateScroll handles boundary edge cases", () => {
  const sourceAnchors = [0, 100, 250, 500];
  const targetAnchors = [0, 150, 300, 600];

  // Exactly at top or before top
  assert.equal(interpolateScroll(-10, sourceAnchors, targetAnchors), 0);
  assert.equal(interpolateScroll(0, sourceAnchors, targetAnchors), 0);

  // Exactly at bottom or beyond bottom
  assert.equal(interpolateScroll(500, sourceAnchors, targetAnchors), 600);
  assert.equal(interpolateScroll(550, sourceAnchors, targetAnchors), 600);

  // Exactly on an internal anchor
  assert.equal(interpolateScroll(100, sourceAnchors, targetAnchors), 150);
  assert.equal(interpolateScroll(250, sourceAnchors, targetAnchors), 300);

  // Halfway between anchors
  // Midpoint between 0 and 100 (50) -> should be midpoint between 0 and 150 (75)
  assert.equal(interpolateScroll(50, sourceAnchors, targetAnchors), 75);

  // Midpoint between 100 and 250 (175) -> midpoint between 150 and 300 (225)
  assert.equal(interpolateScroll(175, sourceAnchors, targetAnchors), 225);
});

test("interpolateScroll is monotonic", () => {
  const sourceAnchors = [0, 80, 120, 300, 600];
  const targetAnchors = [0, 140, 200, 450, 900];

  let prevTarget = -1;
  for (let s = 0; s <= 650; s += 5) {
    const target = interpolateScroll(s, sourceAnchors, targetAnchors);
    assert.ok(target >= prevTarget, `Target should be non-decreasing at s=${s}`);
    prevTarget = target;
  }
});

test("interpolateScroll handles single anchor and zero length gracefully", () => {
  assert.equal(interpolateScroll(50, [], []), 0);
  assert.equal(interpolateScroll(50, [0], [0]), 0);
});

test("getSynchronizedTextareaScroll handles edge cases when environment is missing or empty", () => {
  assert.equal(getSynchronizedTextareaScroll(null, null, [], 0), 0);
  assert.equal(getSynchronizedTextareaScroll(null, null, [0, 100], 0), 0);
});

test("getSynchronizedScrollForTextarea handles edge cases when environment is missing or empty", () => {
  assert.deepEqual(getSynchronizedScrollForTextarea(null, null, [], 0), {
    targetWindowY: 0,
    targetReaderTop: 0,
  });
});

test("getSynchronizedTextareaScroll calculates accurate scrollTop with mock DOM", () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      innerHeight: 800,
      scrollY: 100,
      getComputedStyle: () => ({ paddingTop: "30px" }),
    };

    const mockTextarea = {
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
      getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
    };

    // 3 blocks in reader
    // refY = Math.max(100 + 30, Math.min(200, 540)) = 130
    // Block 0: top 50, next block 1 at top 150 -> span 100, progress at refY=130 is (130-50)/100 = 0.8
    // In textarea: block 0 lineTop=0, block 1 lineTop=100 -> targetLineTop = 0 + 0.8 * 100 = 80
    // scrollTop = targetLineTop + textareaContentTop - refY = 80 + 130 - 130 = 80
    const mockBlocks = [
      { getBoundingClientRect: () => ({ top: 50, bottom: 150 }) },
      { getBoundingClientRect: () => ({ top: 150, bottom: 300 }) },
      { getBoundingClientRect: () => ({ top: 300, bottom: 500 }) },
    ];

    const mockReader = {
      querySelector: (selector) => {
        const match = selector.match(/data-block-index="(\d+)"/);
        if (!match) return null;
        return mockBlocks[Number(match[1])] ?? null;
      },
    };

    const measuredTops = [0, 100, 300];
    const targetScroll = getSynchronizedTextareaScroll(
      mockTextarea,
      mockReader,
      measuredTops,
      3,
    );

    assert.equal(Math.round(targetScroll), 80);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("getSynchronizedScrollForTextarea calculates accurate targetWindowY with mock DOM", () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      innerHeight: 800,
      scrollY: 100,
      getComputedStyle: () => ({ paddingTop: "30px" }),
    };

    const mockTextarea = {
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 80,
      getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
    };

    const mockBlocks = [
      {
        offsetTop: 50,
        getBoundingClientRect: () => ({ top: 50, bottom: 150 }),
      },
      {
        offsetTop: 150,
        getBoundingClientRect: () => ({ top: 150, bottom: 300 }),
      },
    ];

    const mockReader = {
      offsetTop: 0,
      querySelector: (selector) => {
        const match = selector.match(/data-block-index="(\d+)"/);
        if (!match) return null;
        return mockBlocks[Number(match[1])] ?? null;
      },
    };

    const measuredTops = [0, 100];
    const { targetWindowY } = getSynchronizedScrollForTextarea(
      mockTextarea,
      mockReader,
      measuredTops,
      2,
    );

    // scrollTop=80, refY=130, textareaContentTop=130 -> currentLineTopAtRef = 80
    // block 0: currentLineTop=0, nextLineTop=100 -> span=100, progress=0.8
    // pointScreenY in reader = 50 + 0.8 * 100 = 130
    // delta = 130 - 130 = 0 -> targetWindowY = 100 + 0 = 100
    assert.equal(Math.round(targetWindowY), 100);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("computeScrollAnchors handles null elements gracefully", () => {
  const result = computeScrollAnchors(null, null, "text", []);
  assert.deepEqual(result, {
    textareaAnchors: [0],
    readerAnchors: [0],
    pageAnchors: [0],
  });
});

test("computeScrollAnchors produces equal-length, monotonic anchor arrays", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  try {
    globalThis.window = {
      innerHeight: 800,
      scrollY: 0,
      getComputedStyle: () => ({
        padding: "30px",
        paddingTop: "30px",
        fontFamily: "monospace",
        fontSize: "16px",
        fontWeight: "400",
        fontStyle: "normal",
        lineHeight: "24px",
        letterSpacing: "normal",
        direction: "rtl",
      }),
    };

    globalThis.document = {
      createElement: () => ({
        style: {},
        querySelector: (sel) => {
          const match = sel.match(/khana-line-(\d+)/);
          const line = match ? Number(match[1]) : 0;
          return { offsetTop: 30 + line * 40 };
        },
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
      documentElement: {
        scrollHeight: 3000,
      },
    };

    const mockTextarea = {
      scrollHeight: 1500,
      clientHeight: 500,
      clientWidth: 400,
    };

    const mockBlocks = [
      { getBoundingClientRect: () => ({ top: 120, bottom: 200 }) },
      { getBoundingClientRect: () => ({ top: 200, bottom: 450 }) },
      { getBoundingClientRect: () => ({ top: 450, bottom: 800 }) },
      { getBoundingClientRect: () => ({ top: 800, bottom: 1200 }) },
    ];

    const mockReader = {
      scrollTop: 0,
      scrollHeight: 2400,
      clientHeight: 600,
      getBoundingClientRect: () => ({ top: 100, bottom: 700 }),
      querySelector: (selector) => {
        const match = selector.match(/data-block-index="(\d+)"/);
        if (!match) return null;
        return mockBlocks[Number(match[1])] ?? null;
      },
    };

    const text = `# عنوان اول

پاراگراف توضیحی برای تست اسکرول همگام.
خط دوم پاراگراف.

- مورد اول لیست
- مورد دوم لیست

### بخش بعدی
`;

    const ranges = getBlockLineRanges(text);
    assert.equal(ranges.length, 4);

    const anchors = computeScrollAnchors(mockTextarea, mockReader, text, ranges);

    // Each anchor array has length ranges.length + 2 (start 0, end maxScroll)
    assert.equal(anchors.textareaAnchors.length, ranges.length + 2);
    assert.equal(anchors.readerAnchors.length, ranges.length + 2);
    assert.equal(anchors.pageAnchors.length, ranges.length + 2);

    // Initial anchors start at 0
    assert.equal(anchors.textareaAnchors[0], 0);
    assert.equal(anchors.readerAnchors[0], 0);
    assert.equal(anchors.pageAnchors[0], 0);

    // Monotonicity check
    for (let i = 1; i < anchors.textareaAnchors.length; i += 1) {
      assert.ok(
        anchors.textareaAnchors[i] >= anchors.textareaAnchors[i - 1],
        `textareaAnchors must be non-decreasing at index ${i}`,
      );
      assert.ok(
        anchors.readerAnchors[i] >= anchors.readerAnchors[i - 1],
        `readerAnchors must be non-decreasing at index ${i}`,
      );
      assert.ok(
        anchors.pageAnchors[i] >= anchors.pageAnchors[i - 1],
        `pageAnchors must be non-decreasing at index ${i}`,
      );
    }

    // Final anchors match container max scrolls
    assert.equal(anchors.textareaAnchors.at(-1), 1000); // 1500 - 500
    assert.equal(anchors.readerAnchors.at(-1), 1800);   // 2400 - 600
    assert.equal(anchors.pageAnchors.at(-1), 2200);     // 3000 - 800

    // Bidirectional interpolation roundtrip at anchor points
    for (let i = 0; i < anchors.textareaAnchors.length; i += 1) {
      const pageY = interpolateScroll(
        anchors.textareaAnchors[i],
        anchors.textareaAnchors,
        anchors.pageAnchors,
      );
      assert.equal(pageY, anchors.pageAnchors[i]);

      const textareaY = interpolateScroll(
        anchors.pageAnchors[i],
        anchors.pageAnchors,
        anchors.textareaAnchors,
      );
      assert.equal(textareaY, anchors.textareaAnchors[i]);
    }
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
