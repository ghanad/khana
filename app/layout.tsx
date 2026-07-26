import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "خوانا | خواندن درست متن فارسی",
  description:
    "ابزاری ساده و خصوصی برای خواندن روان متن‌های فارسی و ترکیبی راست‌به‌چپ.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
