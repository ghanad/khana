"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { FloatingActions } from "./components/floating-actions";
import { InlineText } from "./components/inline-text";
import { TypographyControls } from "./components/typography-controls";
import { getTextDirection } from "./lib/direction";
import { planPaste } from "./lib/paste";
import {
  getBlockLineRanges,
  parseBlocks,
  type CellAlignment,
} from "./lib/parse-blocks";
import {
  computeScrollAnchors,
  interpolateScroll,
  measureTextareaLineTops,
  type ScrollAnchors,
} from "./lib/sync-scroll";
import { sampleText } from "./lib/sample-text";
import { DEFAULT_SETTINGS, type ReaderSettings } from "./lib/settings";
import {
  clearReaderDocument,
  getReaderServerSnapshot,
  getReaderSnapshot,
  hydrateReaderStore,
  subscribeToReader,
  updateReaderDocument,
  updateReaderSettings,
} from "./lib/reader-store";

const DOCUMENT_SAVE_DELAY = 300;
const FONT_SIZE_STEP = 2;
const SMART_RTL_KEY = "khana:smart-rtl:v1";

let smartRtlSnapshot = true;
const smartRtlListeners = new Set<() => void>();

function subscribeSmartRtl(listener: () => void) {
  smartRtlListeners.add(listener);
  return () => {
    smartRtlListeners.delete(listener);
  };
}

function getSmartRtlSnapshot() {
  return smartRtlSnapshot;
}

function getSmartRtlServerSnapshot() {
  return true;
}

function toggleSmartRtl() {
  smartRtlSnapshot = !smartRtlSnapshot;
  try {
    window.localStorage.setItem(SMART_RTL_KEY, String(smartRtlSnapshot));
  } catch {
    // Storage access may fail
  }
  for (const listener of smartRtlListeners) {
    listener();
  }
}

if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(SMART_RTL_KEY);
    if (stored !== null) {
      smartRtlSnapshot = stored === "true";
    }
  } catch {
    // Storage access may fail
  }
}

const FONT_FAMILY_STACKS: Record<ReaderSettings["fontFamily"], string> = {
  vazir: '"Vazirmatn", Tahoma, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", "Vazirmatn", serif',
  sans: 'Tahoma, Arial, "Vazirmatn", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

// Cells without an explicit delimiter alignment fall back to the surrounding
// text direction, so `undefined` keeps the stylesheet's `text-align: start`.
function alignmentStyle(alignment: CellAlignment) {
  return alignment ? { textAlign: alignment } : undefined;
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
  const { document: text, settings } = useSyncExternalStore(
    subscribeToReader,
    getReaderSnapshot,
    getReaderServerSnapshot,
  );
  const isSmartRtl = useSyncExternalStore(
    subscribeSmartRtl,
    getSmartRtlSnapshot,
    getSmartRtlServerSnapshot,
  );
  const [copied, setCopied] = useState(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isTypographyOpen, setIsTypographyOpen] = useState(false);
  const [isSyncScroll, setIsSyncScroll] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const anchorsRef = useRef<ScrollAnchors | null>(null);
  const measuredTopsRef = useRef<number[]>([]);
  const windowScrollRafRef = useRef<number | null>(null);
  const scrollingSourceRef = useRef<"textarea" | "reader" | "window" | null>(null);
  const syncScrollTimerRef = useRef<number | null>(null);

  // Read the stored document and settings once the client takes over; the
  // server snapshot keeps the first render identical to the SSR output.
  useEffect(() => {
    hydrateReaderStore();
  }, []);

  // Debounced so typing a long text does not write to storage on every key.
  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      updateReaderDocument(text);
    }, DOCUMENT_SAVE_DELAY);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [text]);

  const setSettings = updateReaderSettings;
  const setText = updateReaderDocument;

  const changeFontSize = useCallback(
    (delta: number) => {
      updateReaderSettings({
        ...settings,
        fontSize: settings.fontSize + delta,
      });
    },
    [settings],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        changeFontSize(FONT_SIZE_STEP);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "-") {
        event.preventDefault();
        changeFontSize(-FONT_SIZE_STEP);
        return;
      }

      if (event.key === "Escape") {
        if (isFocusMode) {
          setIsFocusMode(false);
          return;
        }
        if (isTyping) return;
      }

      if (isTyping) return;

      if (event.key === "f" || event.key === "ب") {
        setIsFocusMode((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeFontSize, isFocusMode]);

  const blocks = useMemo(() => parseBlocks(text), [text]);
  const lineRanges = useMemo(() => getBlockLineRanges(text), [text]);

  const refreshAnchors = useCallback(() => {
    if (
      !textareaRef.current ||
      !readerRef.current ||
      !isSyncScroll ||
      isInputCollapsed ||
      isFocusMode
    ) {
      anchorsRef.current = null;
      measuredTopsRef.current = [];
      return;
    }
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const targetLines = lineRanges.map((r) => r.startLine);
    measuredTopsRef.current = measureTextareaLineTops(
      textareaRef.current,
      lines,
      targetLines,
    );
    anchorsRef.current = computeScrollAnchors(
      textareaRef.current,
      readerRef.current,
      text,
      lineRanges,
    );
  }, [text, lineRanges, isSyncScroll, isInputCollapsed, isFocusMode]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      refreshAnchors();
    });
    window.addEventListener("resize", refreshAnchors);
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        refreshAnchors();
      });
    }
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", refreshAnchors);
    };
  }, [refreshAnchors, settings, isSmartRtl]);

  const handleTextareaScroll = useCallback(() => {
    if (
      !isSyncScroll ||
      isInputCollapsed ||
      isFocusMode ||
      !readerRef.current ||
      !textareaRef.current
    ) {
      return;
    }
    if (
      scrollingSourceRef.current === "reader" ||
      scrollingSourceRef.current === "window"
    ) {
      return;
    }

    scrollingSourceRef.current = "textarea";
    if (syncScrollTimerRef.current !== null) {
      window.clearTimeout(syncScrollTimerRef.current);
    }
    syncScrollTimerRef.current = window.setTimeout(() => {
      scrollingSourceRef.current = null;
    }, 60);

    const readerEl = readerRef.current;
    const isReaderScrollable = readerEl.scrollHeight > readerEl.clientHeight + 2;

    let anchors = anchorsRef.current;
    if (!anchors) {
      refreshAnchors();
      anchors = anchorsRef.current;
    }
    if (!anchors) return;

    if (isReaderScrollable) {
      const targetTop = interpolateScroll(
        textareaRef.current.scrollTop,
        anchors.textareaAnchors,
        anchors.readerAnchors,
      );
      readerEl.scrollTop = targetTop;
    } else if (typeof window !== "undefined") {
      const targetWindowY = interpolateScroll(
        textareaRef.current.scrollTop,
        anchors.textareaAnchors,
        anchors.pageAnchors,
      );
      window.scrollTo({ top: targetWindowY, behavior: "instant" });
    }
  }, [isSyncScroll, isInputCollapsed, isFocusMode, refreshAnchors]);

  const handleReaderScroll = useCallback(() => {
    if (
      !isSyncScroll ||
      isInputCollapsed ||
      isFocusMode ||
      !textareaRef.current ||
      !readerRef.current
    ) {
      return;
    }
    if (scrollingSourceRef.current === "textarea") {
      return;
    }

    scrollingSourceRef.current = "reader";
    if (syncScrollTimerRef.current !== null) {
      window.clearTimeout(syncScrollTimerRef.current);
    }
    syncScrollTimerRef.current = window.setTimeout(() => {
      scrollingSourceRef.current = null;
    }, 60);

    let anchors = anchorsRef.current;
    if (!anchors) {
      refreshAnchors();
      anchors = anchorsRef.current;
    }
    if (!anchors) return;

    const targetTop = interpolateScroll(
      readerRef.current.scrollTop,
      anchors.readerAnchors,
      anchors.textareaAnchors,
    );

    textareaRef.current.scrollTop = targetTop;
  }, [isSyncScroll, isInputCollapsed, isFocusMode, refreshAnchors]);

  useEffect(() => {
    function handleWindowScroll() {
      if (
        !isSyncScroll ||
        isInputCollapsed ||
        isFocusMode ||
        !textareaRef.current ||
        !readerRef.current
      ) {
        return;
      }
      if (scrollingSourceRef.current === "textarea") {
        return;
      }
      const isReaderScrollable =
        readerRef.current.scrollHeight > readerRef.current.clientHeight + 2;
      if (isReaderScrollable) {
        return;
      }

      scrollingSourceRef.current = "window";
      if (syncScrollTimerRef.current !== null) {
        window.clearTimeout(syncScrollTimerRef.current);
      }
      syncScrollTimerRef.current = window.setTimeout(() => {
        scrollingSourceRef.current = null;
      }, 60);

      if (windowScrollRafRef.current !== null) {
        window.cancelAnimationFrame(windowScrollRafRef.current);
      }
      windowScrollRafRef.current = window.requestAnimationFrame(() => {
        if (!textareaRef.current || !readerRef.current) return;
        let anchors = anchorsRef.current;
        if (!anchors) {
          refreshAnchors();
          anchors = anchorsRef.current;
        }
        if (!anchors) return;

        const targetTextareaTop = interpolateScroll(
          window.scrollY,
          anchors.pageAnchors,
          anchors.textareaAnchors,
        );
        textareaRef.current.scrollTop = targetTextareaTop;
      });
    }

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      if (windowScrollRafRef.current !== null) {
        window.cancelAnimationFrame(windowScrollRafRef.current);
      }
    };
  }, [isSyncScroll, isInputCollapsed, isFocusMode, refreshAnchors]);

  const characterCount = text.length.toLocaleString("fa-IR");
  const { fontSize, darkMode, fontFamily, lineHeight, measure, paragraphGap } = settings;

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
    const plan = planPaste(event.clipboardData.getData("text"));

    if (plan.action === "ignore") return;

    // Own the insertion. The panel collapses right after, which unmounts this
    // textarea, and a native paste would only run once the handler has returned
    // — by then the node is detached and the pasted text would be lost.
    event.preventDefault();
    setText(plan.text);
    setIsInputCollapsed(true);
  }

  function clearText() {
    clearReaderDocument();
    setIsInputCollapsed(false);
  }

  async function copyText() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const scrollToTop = useCallback(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (textareaRef.current) {
      textareaRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (readerRef.current) {
      readerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const appClassName = [
    "app",
    darkMode ? "theme-dark" : "",
    isFocusMode ? "focus-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const readerStyle = {
    "--reader-size": `${fontSize}px`,
    "--reader-leading": `${lineHeight}`,
    "--reader-measure": `${measure}px`,
    "--reader-paragraph-gap": `${paragraphGap}em`,
    "--reader-family": FONT_FAMILY_STACKS[fontFamily],
  } as React.CSSProperties;

  return (
    <main className={appClassName}>
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
              متن شما فقط روی همین دستگاه می‌ماند
            </span>
            <button
              className="quiet-button"
              type="button"
              onClick={() => setIsFocusMode((current) => !current)}
              aria-pressed={isFocusMode}
              title="حالت مطالعه بدون حواس‌پرتی (کلید f)"
            >
              {isFocusMode ? "خروج از حالت مطالعه" : "حالت مطالعه"}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setSettings({ ...settings, darkMode: !settings.darkMode })
              }
              aria-label={darkMode ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تیره"}
              title={darkMode ? "حالت روشن" : "حالت تیره"}
            >
              <span aria-hidden="true">{darkMode ? "☀" : "☾"}</span>
            </button>
          </div>
        </header>

        {isFocusMode && (
          <div className="focus-bar">
            <span>حالت مطالعه فعال است. برای خروج Esc یا دکمهٔ زیر را بزنید.</span>
            <button
              className="quiet-button"
              type="button"
              onClick={() => setIsFocusMode(false)}
            >
              بازگشت به ویرایش
            </button>
          </div>
        )}

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
                      {text.trim().length > 48 ? "…" : ""}»»
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
                  onScroll={handleTextareaScroll}
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
                  onClick={() => changeFontSize(-FONT_SIZE_STEP)}
                  aria-label="کوچک‌تر کردن متن"
                  disabled={fontSize <= DEFAULT_SETTINGS.fontSize - 2}
                >
                  −
                </button>
                <span>{fontSize.toLocaleString("fa-IR")}</span>
                <button
                  type="button"
                  onClick={() => changeFontSize(FONT_SIZE_STEP)}
                  aria-label="بزرگ‌تر کردن متن"
                  disabled={fontSize >= 28}
                >
                  +
                </button>
                <button
                  className={`sync-scroll-toggle ${isSyncScroll ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setIsSyncScroll((current) => !current)}
                  aria-pressed={isSyncScroll}
                  title={
                    isSyncScroll
                      ? "اسکرول همگام فعال است (کلیک برای غیرفعال‌کردن)"
                      : "اسکرول همگام غیرفعال است (کلیک برای فعال‌کردن)"
                  }
                >
                  اسکرول همگام
                </button>
                <button
                  className={`rtl-mode-toggle ${isSmartRtl ? "is-active" : ""}`}
                  type="button"
                  onClick={toggleSmartRtl}
                  aria-pressed={isSmartRtl}
                  title={
                    isSmartRtl
                      ? "راست‌به‌چپ هوشمند فعال است (پاراگراف با کلمه فارسی، RTL می‌شود)"
                      : "راست‌به‌چپ هوشمند غیرفعال است (حالت استاندارد متن)"
                  }
                >
                  RTL هوشمند
                </button>
                <button
                  className="typography-toggle"
                  type="button"
                  onClick={() => setIsTypographyOpen((current) => !current)}
                  aria-expanded={isTypographyOpen}
                  aria-controls="typography-panel"
                >
                  تنظیمات خواندن
                </button>
              </div>
            </div>

            {isTypographyOpen && (
              <div className="typography-panel" id="typography-panel">
                <TypographyControls
                  settings={settings}
                  onChange={setSettings}
                />
              </div>
            )}

            <div
              ref={readerRef}
              className="reader"
              style={readerStyle}
              onScroll={handleReaderScroll}
              aria-live="polite"
            >
              {!text.trim() ? (
                <EmptyState />
              ) : (
                <div className="rendered-text">
                  {blocks.map((block, index) => {
                    if (block.type === "code") {
                      return (
                        <div
                          className="code-block"
                          key={index}
                          dir="ltr"
                          data-block-index={index}
                        >
                          {block.language && <small>{block.language}</small>}
                          <pre>{block.content}</pre>
                        </div>
                      );
                    }

                    if (block.type === "heading") {
                      const headingLevel = Math.min(block.level + 1, 6);
                      const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
                      return (
                        <Heading
                          key={index}
                          dir={getTextDirection(block.content, isSmartRtl)}
                          data-block-index={index}
                        >
                          <InlineText>{block.content}</InlineText>
                        </Heading>
                      );
                    }

                    if (block.type === "list") {
                      const List = block.ordered ? "ol" : "ul";
                      return (
                        <List
                          key={index}
                          dir={getTextDirection(block.items[0] ?? "", isSmartRtl)}
                          data-block-index={index}
                        >
                          {block.items.map((item, itemIndex) => (
                            <li key={itemIndex} dir={getTextDirection(item, isSmartRtl)}>
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
                          dir={getTextDirection(block.content, isSmartRtl)}
                          data-block-index={index}
                        >
                          <InlineText>{block.content}</InlineText>
                        </blockquote>
                      );
                    }

                    if (block.type === "table") {
                      return (
                        <div
                          className="table-scroll"
                          key={index}
                          data-block-index={index}
                        >
                          <table
                            className="data-table"
                            dir={getTextDirection(block.header.join(""), isSmartRtl)}
                          >
                            <thead>
                              <tr>
                                {block.header.map((cell, cellIndex) => (
                                  <th
                                    key={cellIndex}
                                    scope="col"
                                    style={alignmentStyle(block.align[cellIndex])}
                                  >
                                    <InlineText>{cell}</InlineText>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <td
                                      key={cellIndex}
                                      dir={getTextDirection(cell, isSmartRtl)}
                                      style={alignmentStyle(block.align[cellIndex])}
                                    >
                                      <InlineText>{cell}</InlineText>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    return (
                      <p
                        key={index}
                        dir={getTextDirection(block.content, isSmartRtl)}
                        data-block-index={index}
                      >
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
            «خوانا» همه‌چیز را روی دستگاه شما انجام می‌دهد؛ متن شما فقط در همین
            مرورگر ذخیره می‌شود و هیچ‌وقت به سرور فرستاده نمی‌شود.
          </p>
          <span>ساخته‌شده برای واژه‌هایی که شایستهٔ خوب خوانده‌شدن‌اند.</span>
        </footer>
      </div>

      <FloatingActions
        onScrollToTop={scrollToTop}
        onPaste={pasteText}
        onCopy={copyText}
        isCopied={copied}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((current) => !current)}
        hasText={Boolean(text.trim())}
        onClear={clearText}
      />
    </main>
  );
}
