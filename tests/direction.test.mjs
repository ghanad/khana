import assert from "node:assert/strict";
import test from "node:test";

import { getTextDirection } from "../app/lib/direction.ts";

test("detects right-to-left text", () => {
  assert.equal(getTextDirection("سلام دنیا"), "rtl");
});

test("detects left-to-right text", () => {
  assert.equal(getTextDirection("hello world"), "ltr");
});

test("detects right-to-left when Persian dominates a mixed sentence", () => {
  assert.equal(getTextDirection("این یک متن دربارهٔ Design است"), "rtl");
});

test("detects left-to-right when English dominates a mixed sentence", () => {
  assert.equal(getTextDirection("Read this about طراحی"), "ltr");
});

test("falls back to the embedding level for balanced mixed text", () => {
  assert.equal(getTextDirection(""), "ltr");
  assert.equal(getTextDirection("a ب"), "ltr");
});

test("keeps a Persian paragraph RTL despite one very long Latin word", () => {
  const latin =
    "Supercalifragilisticexpialidocious-antidisestablishmentarianism-pneumonoultramicroscopicsilicovolcanoconiosis";
  // A majority vote on character counts flipped this to "ltr" (107 Latin letters
  // against 22 Persian ones) even though the sentence starts in Persian.
  assert.equal(getTextDirection(`واژهٔ بسیار بلند بدون فاصله: ${latin}`), "rtl");
});

test("uses the first strong character, not the dominant script", () => {
  // A long Persian tail must not drag an English opening to RTL.
  assert.equal(getTextDirection("Deploy the Persian متن نمونه به‌روزرسانی شد"), "ltr");
  // A short English word after a Persian opening must not flip it either.
  assert.equal(getTextDirection("متن فارسی با Design روشن‌تر می‌شود"), "rtl");
});

test("ignores leading neutral characters when picking the direction", () => {
  // Digits, punctuation, quotes and emoji carry no strong direction, so the
  // first letter after them still decides.
  assert.equal(getTextDirection("123 «سلام» 🐕"), "rtl");
  assert.equal(getTextDirection("42 \"hello\""), "ltr");
});

test("keeps a Persian list item RTL when a short English tail wins on count", () => {
  // 6 Persian letters against 7 Latin ones. Majority counting returned "ltr"
  // here, which flipped the whole item and parked its marker on the left.
  assert.equal(getTextDirection("کنید merge را PR ۹"), "rtl");
});

test("falls back to LTR when the text has no strong character", () => {
  assert.equal(getTextDirection("123 456"), "ltr");
  assert.equal(getTextDirection("🐕🧑‍💻"), "ltr");
  assert.equal(getTextDirection("   "), "ltr");
});
