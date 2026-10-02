import assert from "node:assert/strict";
import test from "node:test";

import { normalizePersian } from "../app/lib/normalize.ts";

test("maps Arabic yeh and kaf onto Persian letters", () => {
  assert.equal(normalizePersian("عليكتاب"), "علیکتاب");
  assert.equal(normalizePersian("مكتوب"), "مکتوب");
});

test("maps alef variants and ta marbuta", () => {
  assert.equal(normalizePersian("أحمد"), "احمد");
  assert.equal(normalizePersian("إسلام"), "اسلام");
  assert.equal(normalizePersian("آمنه"), "امنه");
  assert.equal(normalizePersian("مدرسة"), "مدرسه");
});

test("converts Arabic-Indic digits to Persian digits", () => {
  assert.equal(normalizePersian("سال ٢٠٢٤"), "سال ۲۰۲۴");
  assert.equal(normalizePersian("٠١٢٣٤٥٦٧٨٩"), "۰۱۲۳۴۵۶۷۸۹");
});

test("leaves Persian digits and Latin text untouched", () => {
  assert.equal(normalizePersian("شمارهٔ ۱۴۰۳ و Hello"), "شمارهٔ ۱۴۰۳ و Hello");
});

test("normalizes quotation marks", () => {
  assert.equal(normalizePersian("他说 “سلام”"), "他说 «سلام»");
  assert.equal(normalizePersian("“سلام”"), "«سلام»");
});

test("returns empty string unchanged", () => {
  assert.equal(normalizePersian(""), "");
});
