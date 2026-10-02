import bidiFactory from "bidi-js";

const bidi = bidiFactory();

export function getTextDirection(text: string): "rtl" | "ltr" {
  let rtlCount = 0;
  let ltrCount = 0;

  for (const character of text) {
    const type = bidi.getBidiCharTypeName(character);
    if (type === "R" || type === "AL") rtlCount += 1;
    if (type === "L") ltrCount += 1;
  }

  if (rtlCount !== ltrCount) {
    return rtlCount > ltrCount ? "rtl" : "ltr";
  }

  const paragraph = bidi.getEmbeddingLevels(text).paragraphs[0];
  return paragraph && paragraph.level % 2 === 1 ? "rtl" : "ltr";
}