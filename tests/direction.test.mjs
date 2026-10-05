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

test("detects right-to-left when any Persian word exists in a mixed sentence", () => {
  assert.equal(getTextDirection("Read this about طراحی"), "rtl");
  assert.equal(getTextDirection("Read this about طراحی", true), "rtl");
  // When the mode is turned off, standard first-strong rule applies
  assert.equal(getTextDirection("Read this about طراحی", false), "ltr");
});

test("falls back to the embedding level for empty text, but stays RTL with Persian", () => {
  assert.equal(getTextDirection(""), "ltr");
  assert.equal(getTextDirection("a ب"), "rtl");
  assert.equal(getTextDirection("a ب", false), "ltr");
});

test("keeps a Persian paragraph RTL despite one very long Latin word", () => {
  const latin =
    "Supercalifragilisticexpialidocious-antidisestablishmentarianism-pneumonoultramicroscopicsilicovolcanoconiosis";
  // A majority vote on character counts flipped this to "ltr" (107 Latin letters
  // against 22 Persian ones) even though the sentence starts in Persian.
  assert.equal(getTextDirection(`واژهٔ بسیار بلند بدون فاصله: ${latin}`), "rtl");
});

test("makes paragraph RTL if it contains Persian, regardless of opening script", () => {
  // Even with an English opening, any Persian word makes the paragraph RTL when enabled.
  assert.equal(getTextDirection("Deploy the Persian متن نمونه به‌روزرسانی شد"), "rtl");
  assert.equal(getTextDirection("متن فارسی با Design روشن‌تر می‌شود"), "rtl");
  assert.equal(getTextDirection("Deploy the Persian application update"), "ltr");

  // When disabled, first strong character determines direction
  assert.equal(getTextDirection("Deploy the Persian متن نمونه به‌روزرسانی شد", false), "ltr");
  assert.equal(getTextDirection("متن فارسی با Design روشن‌تر می‌شود", false), "rtl");
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
