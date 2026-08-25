import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinc HP Builder｜個人クリニックのホームページ制作",
  description:
    "10ステップの入力だけで、個人クリニックのホームページを作ります。文章も写真もAIが用意し、公開まで最短で進みます。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@500;600&display=swap"
        />
      </head>
      <body
        className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
