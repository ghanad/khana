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
