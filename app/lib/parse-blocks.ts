export type CellAlignment = "left" | "center" | "right" | null;

export type Block =
  | { type: "code"; content: string; language?: string }
  | { type: "heading"; content: string; level: number }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "quote"; content: string }
  | {
      type: "table";
      header: string[];
      rows: string[][];
      align: CellAlignment[];
    }
  | { type: "paragraph"; content: string };

// A GFM table row is any line carrying at least one interior pipe. Rows may or
// may not use the optional leading/trailing pipe, so both forms are accepted.
const TABLE_ROW_PATTERN = /\|.*\|/;
// The delimiter row under the header: every cell is a run of dashes that may
// be wrapped in a single colon to request center or end alignment.
const TABLE_DELIMITER_CELL_PATTERN = /^:?-+:?$/;

// Splits one table line into trimmed cells, dropping the optional outer pipes
// so that `| a | b |` and `a | b` both yield ["a", "b"].
//
// A pipe only separates cells when it is neither backslash-escaped (`\|`) nor
// inside an inline code span (`a | b`), so the line is scanned once rather than
// split naively. Escapes are unescaped in the returned cells.
function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inCode = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\\" && line[index + 1] === "|") {
      current += "|";
      index += 1;
      continue;
    }

    if (character === "`") inCode = !inCode;

    if (character === "|" && !inCode) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);

  // Drop the empty edge cells produced by the optional outer pipes, but keep
  // genuine empty cells such as `| a |  | b |`.
  if (cells.length > 1 && cells[0].trim() === "") cells.shift();
  if (cells.length > 1 && cells[cells.length - 1].trim() === "") cells.pop();

  return cells.map((cell) => cell.trim());
}

function isTableRow(line: string | undefined): boolean {
  return line !== undefined && TABLE_ROW_PATTERN.test(line);
}

function isTableDelimiterRow(line: string | undefined): boolean {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line as string);
  return cells.length > 0 && cells.every((cell) => TABLE_DELIMITER_CELL_PATTERN.test(cell));
}

function toAlignment(cell: string): CellAlignment {
  const starts = cell.startsWith(":");
  const ends = cell.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  if (starts) return "left";
  return null;
}

// Pads short rows and drops overflow cells so every row matches the header
// width and the rendered table stays rectangular.
function fitRow(cells: string[], width: number): string[] {
  return Array.from({ length: width }, (_, index) => cells[index] ?? "");
}

export interface BlockLineRange {
  startLine: number;
  endLine: number;
}

export interface ParsedBlockWithRange {
  block: Block;
  range: BlockLineRange;
}

const LEADING_BIDI_CONTROL_PATTERN =
  /^[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]+/;

const CODE_FENCE_OPEN_PATTERN =
  /^[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]*(`{3,}|~{3,})(.*)$/;

interface CodeFenceOpen {
  fenceChar: "`" | "~";
  fenceLength: number;
  indent: number;
  language: string;
}

function parseCodeFenceOpen(line: string): CodeFenceOpen | null {
  const match = line.match(CODE_FENCE_OPEN_PATTERN);
  if (!match) return null;

  const fence = match[1];
  const fenceChar = fence[0] as "`" | "~";
  const rest = match[2].trim();

  // In CommonMark, backtick info strings cannot contain backticks.
  if (fenceChar === "`" && rest.includes("`")) {
    return null;
  }

  const prefixMatch = line.match(/^[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]*/);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  let indent = 0;
  for (const character of prefix) {
    if (character === " ") indent += 1;
    else if (character === "\t") indent += 4;
  }

  return {
    fenceChar,
    fenceLength: fence.length,
    indent,
    language: rest,
  };
}

function isClosingCodeFence(
  line: string,
  fenceChar: "`" | "~",
  fenceLength: number,
): boolean {
  const trimmed = line
    .replace(/^[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]*/, "")
    .trimEnd();
  if (fenceChar === "`") {
    return /^`{3,}$/.test(trimmed) && trimmed.length >= fenceLength;
  }
  return /^~{3,}$/.test(trimmed) && trimmed.length >= fenceLength;
}

function stripIndent(line: string, maxIndent: number): string {
  if (maxIndent <= 0) return line;
  let stripped = 0;
  let index = 0;
  while (index < line.length && stripped < maxIndent) {
    if (line[index] === " ") {
      stripped += 1;
      index += 1;
    } else if (line[index] === "\t") {
      stripped += 4;
      index += 1;
    } else {
      break;
    }
  }
  return line.slice(index);
}

export function parseBlocksWithRanges(input: string): ParsedBlockWithRange[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const result: ParsedBlockWithRange[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const startLine = index;
    const sanitizedLine = line.replace(LEADING_BIDI_CONTROL_PATTERN, "");

    const codeFence = parseCodeFenceOpen(line);
    if (codeFence) {
      const code: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !isClosingCodeFence(lines[index], codeFence.fenceChar, codeFence.fenceLength)
      ) {
        code.push(stripIndent(lines[index], codeFence.indent));
        index += 1;
      }
      if (
        index < lines.length &&
        isClosingCodeFence(lines[index], codeFence.fenceChar, codeFence.fenceLength)
      ) {
        index += 1;
      }
      result.push({
        block: { type: "code", content: code.join("\n"), language: codeFence.language },
        range: { startLine, endLine: index - 1 },
      });
      continue;
    }

    const heading = sanitizedLine.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      index += 1;
      result.push({
        block: {
          type: "heading",
          level: heading[1].length,
          content: heading[2],
        },
        range: { startLine, endLine: index - 1 },
      });
      continue;
    }

    const unordered = sanitizedLine.match(/^\s*[-*]\s+(.+)$/);
    const ordered = sanitizedLine.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const itemLine = lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "");
        const match = isOrdered
          ? itemLine.match(/^\s*\d+[.)]\s+(.+)$/)
          : itemLine.match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      result.push({
        block: { type: "list", items, ordered: isOrdered },
        range: { startLine, endLine: index - 1 },
      });
      continue;
    }

    if (sanitizedLine.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length) {
        const quoteLine = lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "");
        if (!quoteLine.startsWith("> ")) break;
        quote.push(quoteLine.slice(2));
        index += 1;
      }
      result.push({
        block: { type: "quote", content: quote.join(" ") },
        range: { startLine, endLine: index - 1 },
      });
      continue;
    }

    // A table only starts when a header row is immediately followed by a
    // delimiter row; without that pairing the pipes stay plain paragraph text.
    if (
      isTableRow(sanitizedLine) &&
      isTableDelimiterRow(lines[index + 1]?.replace(LEADING_BIDI_CONTROL_PATTERN, ""))
    ) {
      const header = splitTableRow(sanitizedLine);
      const align = splitTableRow(
        lines[index + 1].replace(LEADING_BIDI_CONTROL_PATTERN, ""),
      ).map(toAlignment);
      index += 2;
      const rows: string[][] = [];
      while (
        index < lines.length &&
        isTableRow(lines[index]?.replace(LEADING_BIDI_CONTROL_PATTERN, ""))
      ) {
        rows.push(
          fitRow(
            splitTableRow(lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "")),
            header.length,
          ),
        );
        index += 1;
      }
      result.push({
        block: { type: "table", header, rows, align },
        range: { startLine, endLine: index - 1 },
      });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseCodeFenceOpen(lines[index]) &&
      !/^(#{1,3})\s+/.test(lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "")) &&
      !/^\s*([-*]|\d+[.)])\s+/.test(lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "")) &&
      !/^>\s/.test(lines[index].replace(LEADING_BIDI_CONTROL_PATTERN, "")) &&
      // A table opening on the next line must not be swallowed as a soft break.
      !(
        isTableRow(lines[index]?.replace(LEADING_BIDI_CONTROL_PATTERN, "")) &&
        isTableDelimiterRow(lines[index + 1]?.replace(LEADING_BIDI_CONTROL_PATTERN, ""))
      )
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    result.push({
      block: { type: "paragraph", content: paragraph.join("\n") },
      range: { startLine, endLine: index - 1 },
    });
  }

  return result;
}

export function parseBlocks(input: string): Block[] {
  return parseBlocksWithRanges(input).map((entry) => entry.block);
}

export function getBlockLineRanges(input: string): BlockLineRange[] {
  return parseBlocksWithRanges(input).map((entry) => entry.range);
}

