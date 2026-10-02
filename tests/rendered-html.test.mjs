import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Khana RTL home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html\s+lang="fa"\s+dir="rtl"/);
  assert.match(html, /<title>خوانا \| خواندن درست متن فارسی<\/title>/);
  assert.match(html, /ابزاری ساده و خصوصی برای خواندن روان متن‌های فارسی/);
  assert.match(html, /متن‌های درهم را، درست و روان بخوانید/);
  assert.match(html, /متن را وارد کنید/);
  assert.match(html, /آرام بخوانید/);
});

test("verifies layout and metadata integrity", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"خوانا \| خواندن درست متن فارسی"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /lang="fa"/);
  assert.match(page, /bidiFactory/);
  assert.match(packageJson, /"bidi-js"/);
});
