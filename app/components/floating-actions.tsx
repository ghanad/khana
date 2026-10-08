"use client";

import { memo } from "react";

interface FloatingActionsProps {
  onScrollToTop: () => void;
  onPaste: () => void;
  onCopy: () => void;
  isCopied: boolean;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  hasText: boolean;
  onClear: () => void;
}

export const FloatingActions = memo(function FloatingActions({
  onScrollToTop,
  onPaste,
  onCopy,
  isCopied,
  isFocusMode,
  onToggleFocusMode,
  hasText,
  onClear,
}: FloatingActionsProps) {
  const handleAction =
    (action: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
      action();
      e.currentTarget.blur();
    };

  return (
    <aside className="floating-actions" aria-label="دسترسی سریع">
      <div className="floating-actions-dock">
        <div className="floating-action-item">
          <button
            type="button"
            className="floating-action-btn"
            onClick={handleAction(onScrollToTop)}
            aria-label="رفتن به بالای صفحه"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          <span className="floating-action-tooltip" role="tooltip">
            رفتن به بالای صفحه
          </span>
        </div>

        <div className="floating-action-item">
          <button
            type="button"
            className="floating-action-btn"
            onClick={handleAction(onPaste)}
            aria-label="چسباندن متن جدید از کلیپ‌بورد"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M12 11v6M9 14l3 3 3-3" />
            </svg>
          </button>
          <span className="floating-action-tooltip" role="tooltip">
            چسباندن متن جدید
          </span>
        </div>

        <div className="floating-action-item">
          <button
            type="button"
            className={`floating-action-btn ${isCopied ? "is-success" : ""}`}
            onClick={handleAction(onCopy)}
            disabled={!hasText}
            aria-label={isCopied ? "متن کپی شد" : "کپی کل متن"}
          >
            {isCopied ? (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <span className="floating-action-tooltip" role="tooltip">
            {isCopied ? "کپی شد ✓" : "کپی کل متن"}
          </span>
        </div>

        <div className="floating-action-item">
          <button
            type="button"
            className={`floating-action-btn ${isFocusMode ? "is-active" : ""}`}
            onClick={handleAction(onToggleFocusMode)}
            aria-pressed={isFocusMode}
            aria-label={isFocusMode ? "خروج از حالت مطالعه" : "حالت مطالعه"}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <span className="floating-action-tooltip" role="tooltip">
            {isFocusMode ? "خروج از حالت مطالعه" : "حالت مطالعه"}
          </span>
        </div>

        <div className="floating-actions-divider" aria-hidden="true" />

        <div className="floating-action-item">
          <button
            type="button"
            className="floating-action-btn danger-hover"
            onClick={handleAction(onClear)}
            disabled={!hasText}
            aria-label="پاک‌کردن متن"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
          <span className="floating-action-tooltip" role="tooltip">
            پاک‌کردن متن
          </span>
        </div>
      </div>
    </aside>
  );
});
