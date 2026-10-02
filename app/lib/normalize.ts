// Maps Arabic letter variants onto their Persian equivalents so text pasted
// from other sources renders with the shapes Persian readers expect.
const LETTER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[يى]/g, "ی"],
  [/ك/g, "ک"],
  [/[أإآ]/g, "ا"],
  [/ة/g, "ه"],
];

const QUOTE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Opening and closing quotes must stay distinguishable, so they are
  // mapped separately rather than collapsed into a single character class.
  [/[“„]/g, "«"],
  [/[”‟]/g, "»"],
  [/'/g, "»"],
];

// Arabic-Indic digits (U+0660..U+0669) to Extended Arabic-Indic (U+06F0..U+06F9).
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;

export function normalizePersian(input: string): string {
  let output = input;

  for (const [pattern, replacement] of LETTER_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of QUOTE_REPLACEMENTS) {
    output = output.replace(pattern, replacement);
  }

  output = output.replace(ARABIC_INDIC_DIGITS, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0x0660 + 0x06f0),
  );

  return output;
}
