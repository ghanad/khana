"use client";

import bidiFactory from "bidi-js";
import { Fragment, useMemo, useRef, useState } from "react";

const bidi = bidiFactory();

const sampleText = `Design می‌تواند ساده، روشن و در عین حال کاربردی باشد؛ مهم این است که هر بخش در جای درست خود قرار بگیرد و خواندن محتوا بدون وقفه پیش برود.

خواندن یک متن روان نباید به تلاش اضافی نیاز داشته باشد. فاصلهٔ مناسب، انتخاب درست واژه‌ها و چینش منظم جمله‌ها کمک می‌کنند مفهوم نوشته سریع‌تر و دقیق‌تر منتقل شود.

گاهی در یک متن فارسی از واژه‌هایی مانند Product Design، User Experience و Front-end Development استفاده می‌کنیم و انتظار داریم همهٔ آن‌ها در کنار جمله‌های فارسی، مرتب و خوانا نمایش داده شوند.

Clear writing makes complex ideas easier to understand. A well-structured interface should help readers focus on the content without distracting them from the main message.

\`\`\`javascript
function greet(name) {
  const message = \`سلام، \${name}!\`;
  return message;
}

console.log(greet("خوانا"));
\`\`\``;

type Block =
  | { type: "code"; content: string; language?: string }
  | { type: "heading"; content: string; level: number }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "quote"; content: string }
  | { type: "paragraph"; content: string };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", content: code.join("\n"), language });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        content: heading[2],
      });
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const match = isOrdered
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "list", items, ordered: isOrdered });
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: "quote", content: quote.join(" ") });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*([-*]|\d+[.)])\s+/.test(lines[index]) &&
      !/^>\s/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraph.join("\n") });
  }

  return blocks;
}

function getTextDirection(text: string): "rtl" | "ltr" {
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

function InlineText({ children }: { children: string }) {
  const parts = children.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={index}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true">
        خوانا
      </div>
      <h2>متن شما اینجا جان می‌گیرد</h2>
      <p>متن فارسی یا ترکیبی را در کادر روبه‌رو وارد کنید.</p>
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(20);
  const [darkMode, setDarkMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const blocks = useMemo(() => parseBlocks(text), [text]);
  const characterCount = text.length.toLocaleString("fa-IR");

  async function pasteText() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setText(clipboardText);
        if (clipboardText.trim()) {
          setIsInputCollapsed(true);
        }
      } else {
        textareaRef.current?.focus();
      }
    } catch {
      textareaRef.current?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData("text");
    if (pasted && pasted.trim()) {
      setTimeout(() => {
        setIsInputCollapsed(true);
      }, 80);
    }
  }

  function clearText() {
    setText("");
    setIsInputCollapsed(false);
  }

  async function copyText() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className={darkMode ? "app theme-dark" : "app"}>
      <div className="page-shell">
        <header className="site-header">
          <a className="brand" href="#" aria-label="خوانا، صفحه اصلی">
            <span className="brand-mark" aria-hidden="true">
              خ
            </span>
            <span>
              <strong>خوانا</strong>
              <small>متن فارسی، بی‌دردسر</small>
            </span>
          </a>

          <div className="header-actions">
            <span className="privacy-note">
              <i aria-hidden="true" />
              متن شما ذخیره نمی‌شود
            </span>
            <button
              className="icon-button"
              type="button"
              onClick={() => setDarkMode((current) => !current)}
              aria-label={darkMode ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تیره"}
              title={darkMode ? "حالت روشن" : "حالت تیره"}
            >
              <span aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
            </button>
          </div>
        </header>

        <section className="intro" aria-labelledby="page-title">
          <div className="intro-heading">
            <span className="eyebrow">ابزار خواندن متن</span>
            <h1 id="page-title">متن‌های درهم را، درست و روان بخوانید.</h1>
          </div>
          <p>
            متن فارسیِ ترکیب‌شده با انگلیسی، کد و عدد را بچسبانید؛ «خوانا» جهت
            و فاصله‌ها را برای مطالعه‌ای آرام‌تر مرتب می‌کند.
          </p>
        </section>

        <section
          className={
            isInputCollapsed
              ? "workspace input-collapsed"
              : "workspace"
          }
          aria-label="ویرایشگر و پیش‌نمایش متن"
        >
          <article
            className={
              isInputCollapsed
                ? "panel input-panel is-collapsed"
                : "panel input-panel"
            }
          >
            {isInputCollapsed ? (
              <div className="collapsed-bar">
                <div className="collapsed-info">
                  <span className="step">۱</span>
                  <div className="collapsed-titles">
                    <span className="collapsed-title">متن اصلی</span>
                    <span className="counter">{characterCount} نویسه</span>
                  </div>
                  {text.trim() && (
                    <span className="collapsed-snippet" title={text}>
                      «{text.replace(/\s+/g, " ").trim().slice(0, 48)}
                      {text.trim().length > 48 ? "…" : ""}»
                    </span>
                  )}
                </div>

                <div className="collapsed-actions">
                  <button
                    className="text-button collapse-toggle-button"
                    type="button"
                    onClick={() => {
                      setIsInputCollapsed(false);
                      setTimeout(() => textareaRef.current?.focus(), 60);
                    }}
                    aria-label="ویرایش متن اصلی"
                  >
                    <span aria-hidden="true">✎</span>
                    ویرایش متن
                  </button>
                  <button
                    className="quiet-button"
                    type="button"
                    onClick={pasteText}
                    title="چسباندن متن جدید از کلیپ‌بورد"
                  >
                    چسباندن مجدد
                  </button>
                  <button
                    className="quiet-button danger"
                    type="button"
                    onClick={clearText}
                    title="پاک‌کردن متن"
                  >
                    پاک‌کردن
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="panel-header">
                  <div>
                    <span className="step">۱</span>
                    <h2>متن را وارد کنید</h2>
                  </div>
                  <div className="input-header-tools">
                    <span className="counter">{characterCount} نویسه</span>
                    {text.trim() && (
                      <button
                        className="collapse-action-button"
                        type="button"
                        onClick={() => setIsInputCollapsed(true)}
                        title="جمع‌کردن کادر ورودی برای فضای بیشتر مطالعه"
                      >
                        جمع‌کردن کادر ↑
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  dir="auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onPaste={handlePaste}
                  placeholder="متن خود را اینجا بنویسید یا بچسبانید…"
                  aria-label="متن ورودی"
                  spellCheck="false"
                />

                <div className="panel-footer input-footer">
                  <button className="text-button" type="button" onClick={pasteText}>
                    چسباندن از کلیپ‌بورد
                  </button>
                  <div className="input-secondary-actions">
                    <button
                      className="quiet-button"
                      type="button"
                      onClick={() => setText(sampleText)}
                    >
                      متن نمونه
                    </button>
                    <button
                      className="quiet-button danger"
                      type="button"
                      onClick={clearText}
                      disabled={!text}
                    >
                      پاک‌کردن
                    </button>
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="panel preview-panel">
            <div className="panel-header">
              <div>
                <span className="step">۲</span>
                <h2>آرام بخوانید</h2>
              </div>
              <div className="reader-tools" aria-label="تنظیم اندازه متن">
                <button
                  type="button"
                  onClick={() => setFontSize((size) => Math.max(16, size - 2))}
                  aria-label="کوچک‌تر کردن متن"
                  disabled={fontSize === 16}
                >
                  −
                </button>
                <span>{fontSize.toLocaleString("fa-IR")}</span>
                <button
                  type="button"
                  onClick={() => setFontSize((size) => Math.min(28, size + 2))}
                  aria-label="بزرگ‌تر کردن متن"
                  disabled={fontSize === 28}
                >
                  +
                </button>
              </div>
            </div>

            <div
              className="reader"
              style={{ "--reader-size": `${fontSize}px` } as React.CSSProperties}
              aria-live="polite"
            >
              {!text.trim() ? (
                <EmptyState />
              ) : (
                <div className="rendered-text">
                  {blocks.map((block, index) => {
                    if (block.type === "code") {
                      return (
                        <div className="code-block" key={index} dir="ltr">
                          {block.language && <small>{block.language}</small>}
                          <pre>{block.content}</pre>
                        </div>
                      );
                    }

                    if (block.type === "heading") {
                      const Heading = `h${block.level + 1}` as "h2" | "h3" | "h4";
                      return (
                        <Heading key={index} dir={getTextDirection(block.content)}>
                          <InlineText>{block.content}</InlineText>
                        </Heading>
                      );
                    }

                    if (block.type === "list") {
                      const List = block.ordered ? "ol" : "ul";
                      return (
                        <List
                          key={index}
                          dir={getTextDirection(block.items[0] ?? "")}
                        >
                          {block.items.map((item, itemIndex) => (
                            <li key={itemIndex} dir={getTextDirection(item)}>
                              <InlineText>{item}</InlineText>
                            </li>
                          ))}
                        </List>
                      );
                    }

                    if (block.type === "quote") {
                      return (
                        <blockquote
                          key={index}
                          dir={getTextDirection(block.content)}
                        >
                          <InlineText>{block.content}</InlineText>
                        </blockquote>
                      );
                    }

                    return (
                      <p key={index} dir={getTextDirection(block.content)}>
                        <InlineText>{block.content}</InlineText>
                      </p>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-footer">
              <span className="format-note">پشتیبانی از متن ساده و Markdown</span>
              <button
                className="copy-button"
                type="button"
                onClick={copyText}
                disabled={!text}
              >
                {copied ? "کپی شد ✓" : "کپی متن"}
              </button>
            </div>
          </article>
        </section>

        <footer className="site-footer">
          <p>
            «خوانا» همه‌چیز را روی دستگاه شما انجام می‌دهد؛ چیزی به سرور فرستاده
            نمی‌شود.
          </p>
          <span>ساخته‌شده برای واژه‌هایی که شایستهٔ خوب خوانده‌شدن‌اند.</span>
        </footer>
      </div>
    </main>
  );
}
