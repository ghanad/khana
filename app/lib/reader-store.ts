import { clampSettings, DEFAULT_SETTINGS, type ReaderSettings } from "./settings";
export const DOCUMENT_KEY = "khana:document:v1";
export const SETTINGS_KEY = "khana:settings:v1";

// A tiny external store over localStorage so that reading state during render
// stays correct. useSyncExternalStore supplies the server snapshot on the
// first render, which keeps hydration consistent, and re-renders once the
// real client value is available.
const EMPTY_DOCUMENT = "";
const SERVER_SETTINGS = DEFAULT_SETTINGS;

let snapshot = {
  document: EMPTY_DOCUMENT,
  settings: SERVER_SETTINGS,
};
let isHydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return { document: EMPTY_DOCUMENT, settings: SERVER_SETTINGS };
}

export const getReaderSnapshot = getSnapshot;
export const getReaderServerSnapshot = getServerSnapshot;

export function subscribeToReader(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored() {
  let document = EMPTY_DOCUMENT;
  let settings = SERVER_SETTINGS;

  try {
    document = window.localStorage.getItem(DOCUMENT_KEY) ?? EMPTY_DOCUMENT;
    const rawSettings = window.localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) settings = clampSettings(JSON.parse(rawSettings));
  } catch {
    // Unreadable storage falls back to the empty defaults.
  }

  snapshot = { document, settings };
  isHydrated = true;
  emit();
}

// Hydration and future same-tab changes both flow through here.
if (typeof window !== "undefined") {
  window.addEventListener("storage", readStored);
}

export function hydrateReaderStore() {
  readStored();
}

export function isReaderStoreHydrated() {
  return isHydrated;
}

export function updateReaderDocument(text: string) {
  snapshot = { ...snapshot, document: text };
  emit();
  try {
    window.localStorage.setItem(DOCUMENT_KEY, text);
  } catch {
    // Persistence is best-effort; the reader still works without it.
  }
}

export function clearReaderDocument() {
  try {
    window.localStorage.removeItem(DOCUMENT_KEY);
  } catch {
    // Ignore storage failures.
  }
  updateReaderDocument(EMPTY_DOCUMENT);
}

export function updateReaderSettings(next: ReaderSettings) {
  const settings = clampSettings(next);
  snapshot = { ...snapshot, settings };
  emit();
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}
