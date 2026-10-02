import assert from "node:assert/strict";
import test from "node:test";

import { clampSettings, DEFAULT_SETTINGS, FONT_FAMILIES } from "../app/lib/settings.ts";

test("returns defaults for missing input", () => {
  assert.deepEqual(clampSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(clampSettings(undefined), DEFAULT_SETTINGS);
});

test("keeps values already inside the allowed range", () => {
  const settings = clampSettings({
    fontSize: 22,
    lineHeight: 2,
    measure: 800,
    paragraphGap: 1.5,
    fontFamily: "serif",
    darkMode: true,
  });
  assert.deepEqual(settings, {
    fontSize: 22,
    lineHeight: 2,
    measure: 800,
    paragraphGap: 1.5,
    fontFamily: "serif",
    darkMode: true,
  });
});

test("clamps values outside the allowed range", () => {
  const settings = clampSettings({
    fontSize: 900,
    lineHeight: 0.2,
    measure: 99999,
    paragraphGap: -4,
  });
  assert.equal(settings.fontSize, 28);
  assert.equal(settings.lineHeight, 1.6);
  assert.equal(settings.measure, 980);
  assert.equal(settings.paragraphGap, 0.6);
});

test("rejects non-numeric and non-finite values", () => {
  const settings = clampSettings({
    fontSize: "24",
    lineHeight: Number.NaN,
    measure: Number.POSITIVE_INFINITY,
  });
  assert.equal(settings.fontSize, DEFAULT_SETTINGS.fontSize);
  assert.equal(settings.lineHeight, DEFAULT_SETTINGS.lineHeight);
  assert.equal(settings.measure, DEFAULT_SETTINGS.measure);
});

test("falls back on an unknown font family", () => {
  const settings = clampSettings({ fontFamily: "comic" });
  assert.equal(settings.fontFamily, DEFAULT_SETTINGS.fontFamily);
  assert.ok(FONT_FAMILIES.includes(settings.fontFamily));
});
