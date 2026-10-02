import bidiFactory from "bidi-js";

const bidi = bidiFactory();

// Only these bidi classes are "strong". A paragraph's direction comes from the
// first one of them it contains (Unicode UAX #9 rules P2/P3), not from whichever
// script happens to contribute the most characters. Everything else -- digits,
// punctuation, spaces, symbols, emoji -- is skipped while looking for it.
function isStrongRtl(type: string) {
  return type === "R" || type === "AL";
}

function isStrongLtr(type: string) {
  return type === "L";
}

/**
 * Returns the base paragraph direction for a piece of text.
 *
 * Uses the UAX #9 P2/P3 rule: the first strongly directional character wins.
 * Counting characters instead would let one long Latin word inside a Persian
 * sentence flip the whole paragraph to LTR, which is what a majority vote on
 * bidi classes used to do here.
 */
export function getTextDirection(text: string): "rtl" | "ltr" {
  for (const character of text) {
    const type = bidi.getBidiCharTypeName(character);

    if (isStrongRtl(type)) return "rtl";
    if (isStrongLtr(type)) return "ltr";
  }

  // No strong character at all: pure digits, punctuation or emoji have no
  // intrinsic direction, so fall back to the resolved embedding level and to
  // LTR for empty or whitespace-only text.
  const paragraph = bidi.getEmbeddingLevels(text).paragraphs[0];
  return paragraph && paragraph.level % 2 === 1 ? "rtl" : "ltr";
}