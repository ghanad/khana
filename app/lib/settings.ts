export const FONT_FAMILIES = ["vazir", "serif", "sans", "mono"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export type ReaderSettings = {
  fontSize: number;
  lineHeight: number;
  measure: number;
  paragraphGap: number;
  fontFamily: FontFamily;
  darkMode: boolean;
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 20,
  lineHeight: 2.18,
  measure: 740,
  paragraphGap: 1.25,
  fontFamily: "vazir",
  darkMode: false,
};

export const LIMITS = {
  fontSize: { min: 16, max: 28, step: 2 },
  lineHeight: { min: 1.6, max: 2.8, step: 0.06 },
  measure: { min: 480, max: 980, step: 20 },
  paragraphGap: { min: 0.6, max: 2.4, step: 0.2 },
} as const;

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampSettings(input: Partial<ReaderSettings> | null | undefined): ReaderSettings {
  if (!input || typeof input !== "object") return { ...DEFAULT_SETTINGS };

  const fontFamily = FONT_FAMILIES.includes(input.fontFamily as FontFamily)
    ? (input.fontFamily as FontFamily)
    : DEFAULT_SETTINGS.fontFamily;

  return {
    fontSize: clampNumber(input.fontSize, LIMITS.fontSize.min, LIMITS.fontSize.max, DEFAULT_SETTINGS.fontSize),
    lineHeight: clampNumber(input.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max, DEFAULT_SETTINGS.lineHeight),
    measure: clampNumber(input.measure, LIMITS.measure.min, LIMITS.measure.max, DEFAULT_SETTINGS.measure),
    paragraphGap: clampNumber(input.paragraphGap, LIMITS.paragraphGap.min, LIMITS.paragraphGap.max, DEFAULT_SETTINGS.paragraphGap),
    fontFamily,
    darkMode: typeof input.darkMode === "boolean" ? input.darkMode : DEFAULT_SETTINGS.darkMode,
  };
}
