import { Fragment } from "react";

import { normalizePersian } from "../lib/normalize";

// Inline Markdown is limited to inline code and bold, matching the subset the
// reader advertises. Code spans are left un-normalized so identifiers survive.
const INLINE_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
const INLINE_CODE_PATTERN = /^`[^`\n]+`$/;
const BOLD_PATTERN = /^\*\*[^*\n]+\*\*$/;

export function InlineText({ children }: { children: string }) {
  const parts = children.split(INLINE_PATTERN);

  return (
    <>
      {parts.map((part, index) => {
        if (INLINE_CODE_PATTERN.test(part)) {
          return <code key={index}>{part.slice(1, -1)}</code>;
        }
        if (BOLD_PATTERN.test(part)) {
          return <strong key={index}>{normalizePersian(part.slice(2, -2))}</strong>;
        }
        return <Fragment key={index}>{normalizePersian(part)}</Fragment>;
      })}
    </>
  );
}
