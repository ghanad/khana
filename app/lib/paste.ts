export type PastePlan =
  | { action: "ignore" }
  | { action: "default" }
  | { action: "replace"; text: string };

/**
 * Decides what a paste into the source textarea should do.
 *
 * A native paste splices the clipboard text in at the caret, which glues the new
 * text onto whatever is already there (or into the middle of it) and reads as
 * accidental accumulation. So when there is existing text and the selection is
 * not the whole document, replace the document outright. An empty field, or a
 * selection that already covers everything, is left to the browser because the
 * native behaviour already replaces the content in those cases.
 */
export function planPaste(
  pasted: string,
  current: string,
  selectionStart: number,
  selectionEnd: number,
): PastePlan {
  if (!pasted || !pasted.trim()) return { action: "ignore" };
  if (!current.trim()) return { action: "default" };
  if (selectionStart === 0 && selectionEnd === current.length) {
    return { action: "default" };
  }
  return { action: "replace", text: pasted };
}