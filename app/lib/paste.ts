export type PastePlan =
  | { action: "ignore" }
  | { action: "replace"; text: string };

/**
 * Decides what a paste into the source textarea should do.
 *
 * A native paste splices the clipboard text in at the caret, which glues the new
 * text onto whatever is already there (or into the middle of it) and reads as
 * accidental accumulation. A paste therefore replaces the document outright.
 *
 * The insertion is always owned by us rather than left to the browser, even when
 * the field is empty or the selection already spans the whole document and the
 * native behaviour would produce the same result. The input panel collapses on
 * paste, which unmounts this textarea, and the browser only runs a native paste
 * after the event handlers have returned, so the text would be inserted into a
 * detached node and never appear. Applying it here keeps the outcome identical
 * to the native one without depending on that ordering.
 *
 * A paste with no meaningful text is left to the browser, so an empty or
 * whitespace-only clipboard still behaves normally.
 */
export function planPaste(pasted: string): PastePlan {
  if (!pasted || !pasted.trim()) return { action: "ignore" };
  return { action: "replace", text: pasted };
}