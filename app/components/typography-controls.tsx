"use client";

import { LIMITS, type ReaderSettings } from "../lib/settings";

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: RangeControlProps) {
  const id = `typography-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="typography-control">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output htmlFor={id}>{format(value)}</output>
    </div>
  );
}

type TypographyControlsProps = {
  settings: ReaderSettings;
  onChange: (next: ReaderSettings) => void;
};

const FONT_LABELS: Record<ReaderSettings["fontFamily"], string> = {
  vazir: "وزیرمتن",
  serif: "سریف",
  sans: "بدون‌سریف",
  mono: "تک‌عرض",
};

export function TypographyControls({ settings, onChange }: TypographyControlsProps) {
  function update(patch: Partial<ReaderSettings>) {
    onChange({ ...settings, ...patch });
  }

  return (
    <div className="typography-controls" aria-label="تنظیمات خواندن">
      <RangeControl
        label="فاصلهٔ خطوط"
        value={settings.lineHeight}
        min={LIMITS.lineHeight.min}
        max={LIMITS.lineHeight.max}
        step={LIMITS.lineHeight.step}
        format={(value) => value.toFixed(2).replace(".", "٫")}
        onChange={(lineHeight) => update({ lineHeight })}
      />

      <RangeControl
        label="عرض متن"
        value={settings.measure}
        min={LIMITS.measure.min}
        max={LIMITS.measure.max}
        step={LIMITS.measure.step}
        format={(value) => `${value.toLocaleString("fa-IR")} پیکسل`}
        onChange={(measure) => update({ measure })}
      />

      <RangeControl
        label="فاصلهٔ پاراگراف"
        value={settings.paragraphGap}
        min={LIMITS.paragraphGap.min}
        max={LIMITS.paragraphGap.max}
        step={LIMITS.paragraphGap.step}
        format={(value) => value.toFixed(1).replace(".", "٫")}
        onChange={(paragraphGap) => update({ paragraphGap })}
      />

      <div className="typography-control">
        <label htmlFor="typography-font-family">قلم</label>
        <select
          id="typography-font-family"
          value={settings.fontFamily}
          onChange={(event) =>
            update({ fontFamily: event.target.value as ReaderSettings["fontFamily"] })
          }
        >
          {Object.entries(FONT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
