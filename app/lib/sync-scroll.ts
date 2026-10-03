import type { BlockLineRange } from "./parse-blocks";

export interface ScrollAnchors {
  textareaAnchors: number[];
  readerAnchors: number[];
  pageAnchors: number[];
}

/**
 * Interpolates scroll position between precomputed source and target anchor points
 * using binary search and linear interpolation.
 *
 * Runs in O(log N) without reading DOM geometry, making it safe and smooth for 60fps/120fps scrolling.
 */
export function interpolateScroll(
  sourceScrollTop: number,
  sourceAnchors: number[],
  targetAnchors: number[],
): number {
  if (sourceAnchors.length === 0 || targetAnchors.length === 0) {
    return 0;
  }
  if (sourceAnchors.length !== targetAnchors.length) {
    throw new Error("Anchor arrays must have identical length");
  }

  const lastIndex = sourceAnchors.length - 1;

  if (sourceScrollTop <= sourceAnchors[0]) {
    return targetAnchors[0];
  }
  if (sourceScrollTop >= sourceAnchors[lastIndex]) {
    return targetAnchors[lastIndex];
  }

  // Binary search for the interval [low, low + 1] containing sourceScrollTop
  let low = 0;
  let high = lastIndex;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (sourceAnchors[mid] <= sourceScrollTop) {
      if (mid === lastIndex || sourceAnchors[mid + 1] > sourceScrollTop) {
        low = mid;
        break;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const sourceStart = sourceAnchors[low];
  const sourceEnd = sourceAnchors[low + 1];
  const targetStart = targetAnchors[low];
  const targetEnd = targetAnchors[low + 1];

  const sourceSpan = sourceEnd - sourceStart;
  if (sourceSpan <= 0) {
    return targetStart;
  }

  const progress = (sourceScrollTop - sourceStart) / sourceSpan;
  return targetStart + progress * (targetEnd - targetStart);
}

/**
 * Measures line top offsets inside a textarea using a hidden mirror element
 * that mirrors the textarea font, line-height, padding, and width.
 */
export function measureTextareaLineTops(
  textarea: HTMLTextAreaElement,
  lines: string[],
  targetLines: number[],
): number[] {
  if (typeof document === "undefined" || targetLines.length === 0) {
    return targetLines.map(() => 0);
  }

  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.top = "-9999px";
  mirror.style.left = "-9999px";
  mirror.style.boxSizing = "border-box";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.padding = computed.padding;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.fontStyle = computed.fontStyle;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak = "break-word";
  mirror.style.overflowWrap = "break-word";
  mirror.style.direction = computed.direction;

  const targetSet = new Set(targetLines);
  const fragments: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (targetSet.has(i)) {
      fragments.push(`<span id="khana-line-${i}">&#8203;</span>`);
    }
    // Escape HTML to prevent injection in mirror
    const escaped = lines[i]
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    fragments.push(escaped);
    if (i < lines.length - 1) {
      fragments.push("\n");
    }
  }

  mirror.innerHTML = fragments.join("");
  document.body.appendChild(mirror);

  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const tops = targetLines.map((lineIndex) => {
    const marker = mirror.querySelector(`#khana-line-${lineIndex}`) as HTMLElement | null;
    if (!marker) return 0;
    // marker.offsetTop is relative to mirror border box; subtract paddingTop so scrollTop=0 matches line 0
    return Math.max(0, marker.offsetTop - paddingTop);
  });

  document.body.removeChild(mirror);
  return tops;
}

/**
 * Computes synchronized scroll anchor pairs between the textarea, reader, and window.
 */
export function computeScrollAnchors(
  textarea: HTMLTextAreaElement | null,
  reader: HTMLElement | null,
  text: string,
  ranges: BlockLineRange[],
): ScrollAnchors {
  if (!textarea || !reader || ranges.length === 0) {
    return { textareaAnchors: [0], readerAnchors: [0], pageAnchors: [0] };
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const targetLines = ranges.map((r) => r.startLine);
  const measuredTextareaTops = measureTextareaLineTops(textarea, lines, targetLines);

  const readerRect = reader.getBoundingClientRect();
  const currentReaderScroll = reader.scrollTop;
  const textareaRect = textarea.getBoundingClientRect();
  const textareaPaddingTop = typeof window !== "undefined"
    ? parseFloat(window.getComputedStyle(textarea).paddingTop) || 0
    : 0;
  const textareaContentTop = textareaRect.top + textareaPaddingTop;
  const currentWindowScroll = typeof window !== "undefined" ? window.scrollY : 0;

  const textareaAnchors: number[] = [0];
  const readerAnchors: number[] = [0];
  const pageAnchors: number[] = [0];

  let prevTextarea = 0;
  let prevReader = 0;
  let prevPage = 0;

  for (let i = 0; i < ranges.length; i += 1) {
    // 1. Textarea anchor for block i
    const rawTextareaTop = measuredTextareaTops[i] ?? 0;
    const textareaTop = Math.max(prevTextarea, rawTextareaTop);
    prevTextarea = textareaTop;

    // 2. Reader anchor for block i
    const blockEl = reader.querySelector(`[data-block-index="${i}"]`) as HTMLElement | null;
    let readerTop = prevReader;
    let pageTop = prevPage;

    if (blockEl) {
      const blockRect = blockEl.getBoundingClientRect();
      const relativeTop = blockRect.top - readerRect.top + currentReaderScroll;
      readerTop = Math.max(prevReader, relativeTop);

      const blockDocTop = blockRect.top + currentWindowScroll;
      pageTop = Math.max(prevPage, Math.max(0, blockDocTop - textareaContentTop));
    }

    prevReader = readerTop;
    prevPage = pageTop;

    textareaAnchors.push(textareaTop);
    readerAnchors.push(readerTop);
    pageAnchors.push(pageTop);
  }

  // Final anchors: maximum scroll of all containers
  const maxTextareaScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
  const maxReaderScroll = Math.max(0, reader.scrollHeight - reader.clientHeight);
  const maxPageScroll = typeof document !== "undefined" && typeof window !== "undefined"
    ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    : 0;

  textareaAnchors.push(Math.max(prevTextarea, maxTextareaScroll));
  readerAnchors.push(Math.max(prevReader, maxReaderScroll));
  pageAnchors.push(Math.max(prevPage, maxPageScroll));

  return { textareaAnchors, readerAnchors, pageAnchors };
}

/**
 * Calculates the exact textarea.scrollTop required to horizontally align the matching
 * markdown line with whatever rendered block is currently at the viewing line of the screen.
 */
export function getSynchronizedTextareaScroll(
  textarea: HTMLTextAreaElement,
  reader: HTMLElement,
  measuredTextareaTops: number[],
  rangesCount: number,
): number {
  if (rangesCount === 0 || measuredTextareaTops.length === 0 || typeof window === "undefined") {
    return 0;
  }

  const textareaRect = textarea.getBoundingClientRect();
  const textareaPaddingTop = parseFloat(window.getComputedStyle(textarea).paddingTop) || 0;
  const textareaContentTop = textareaRect.top + textareaPaddingTop;

  // The screen Y coordinate where we horizontally align reader and editor:
  // When near the top of the page, align with the top of the textarea content.
  // When scrolled down and textareaContentTop goes above the screen,
  // align at a comfortable reading line (80px from top of viewport).
  const refY = Math.max(
    textareaContentTop,
    Math.min(80, textareaRect.bottom - 60),
  );

  // Find all block elements
  const blockEls: HTMLElement[] = [];
  for (let i = 0; i < rangesCount; i += 1) {
    const el = reader.querySelector(`[data-block-index="${i}"]`) as HTMLElement | null;
    if (el) blockEls.push(el);
  }

  if (blockEls.length === 0) {
    return 0;
  }

  // Find the block currently spanning across refY
  let activeIndex = 0;
  for (let i = 0; i < blockEls.length; i += 1) {
    const rect = blockEls[i].getBoundingClientRect();
    if (rect.top <= refY + 4) {
      activeIndex = i;
    } else {
      break;
    }
  }

  const activeEl = blockEls[activeIndex];
  const activeRect = activeEl.getBoundingClientRect();
  const nextEl = blockEls[activeIndex + 1] as HTMLElement | undefined;
  const nextTop = nextEl ? nextEl.getBoundingClientRect().top : (activeRect.bottom + 24);

  const blockSpan = Math.max(1, nextTop - activeRect.top);
  const progress = Math.max(0, Math.min(1, (refY - activeRect.top) / blockSpan));

  const currentLineTop = measuredTextareaTops[activeIndex] ?? 0;
  const nextLineTop = activeIndex + 1 < measuredTextareaTops.length
    ? (measuredTextareaTops[activeIndex + 1] ?? currentLineTop)
    : Math.max(currentLineTop, textarea.scrollHeight - textarea.clientHeight);

  const targetLineTop = currentLineTop + progress * (nextLineTop - currentLineTop);

  // Derive target scrollTop so that targetLineTop is placed exactly at refY on screen:
  // lineScreenY = textareaContentTop + (targetLineTop - scrollTop) = refY
  // => scrollTop = targetLineTop + textareaContentTop - refY
  const targetTop = targetLineTop + textareaContentTop - refY;
  return Math.max(0, Math.min(textarea.scrollHeight - textarea.clientHeight, targetTop));
}

/**
 * Calculates the exact window scroll (or reader internal scroll) required so that
 * the rendered block aligns horizontally on the screen with the textarea's current line.
 */
export function getSynchronizedScrollForTextarea(
  textarea: HTMLTextAreaElement,
  reader: HTMLElement,
  measuredTextareaTops: number[],
  rangesCount: number,
): { targetWindowY: number; targetReaderTop: number } {
  if (typeof window === "undefined" || rangesCount === 0 || measuredTextareaTops.length === 0) {
    return { targetWindowY: 0, targetReaderTop: 0 };
  }

  const scrollTop = textarea.scrollTop;
  const textareaRect = textarea.getBoundingClientRect();
  const textareaPaddingTop = parseFloat(window.getComputedStyle(textarea).paddingTop) || 0;
  const textareaContentTop = textareaRect.top + textareaPaddingTop;
  const refY = Math.max(
    textareaContentTop,
    Math.min(80, textareaRect.bottom - 60),
  );

  // The line offset inside textarea currently visible at refY:
  // lineScreenY = textareaContentTop + (lineTop - scrollTop) = refY
  // => lineTop = scrollTop + refY - textareaContentTop
  const currentLineTopAtRef = Math.max(0, scrollTop + refY - textareaContentTop);

  // Binary search to find the active block interval in textarea
  let low = 0;
  let high = measuredTextareaTops.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measuredTextareaTops[mid] <= currentLineTopAtRef) {
      if (mid === measuredTextareaTops.length - 1 || measuredTextareaTops[mid + 1] > currentLineTopAtRef) {
        low = mid;
        break;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const activeIndex = Math.min(low, rangesCount - 1);
  const currentLineTop = measuredTextareaTops[activeIndex] ?? 0;
  const maxScroll = Math.max(1, textarea.scrollHeight - textarea.clientHeight);
  const nextLineTop = activeIndex + 1 < measuredTextareaTops.length
    ? (measuredTextareaTops[activeIndex + 1] ?? currentLineTop)
    : maxScroll;

  const span = Math.max(1, nextLineTop - currentLineTop);
  const progress = Math.max(0, Math.min(1, (currentLineTopAtRef - currentLineTop) / span));

  const activeEl = reader.querySelector(`[data-block-index="${activeIndex}"]`) as HTMLElement | null;
  const nextEl = reader.querySelector(`[data-block-index="${activeIndex + 1}"]`) as HTMLElement | null;

  if (!activeEl) {
    return { targetWindowY: window.scrollY, targetReaderTop: 0 };
  }

  const activeRect = activeEl.getBoundingClientRect();
  const nextTop = nextEl ? nextEl.getBoundingClientRect().top : (activeRect.bottom + 24);
  const blockHeight = Math.max(1, nextTop - activeRect.top);

  // Screen Y of the corresponding point in reader block:
  const pointScreenY = activeRect.top + progress * blockHeight;
  // We want pointScreenY to be at refY on screen:
  const delta = pointScreenY - refY;
  const targetWindowY = Math.max(0, window.scrollY + delta);

  const targetReaderTop = activeEl.offsetTop - reader.offsetTop + progress * blockHeight;

  return { targetWindowY, targetReaderTop };
}

