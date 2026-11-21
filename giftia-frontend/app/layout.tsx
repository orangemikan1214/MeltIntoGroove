import type { Metadata } from "next";
import { Shippori_Mincho_B1, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 見出し・ロゴ用の明朝体。globals.css の var(--font-heading) から使われる
const headingFont = Shippori_Mincho_B1({
  variable: "--font-heading",
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
});

// 本文用のゴシック体。globals.css の var(--font-body) から使われる（全ページの文字）
const bodyFont = Zen_Kaku_Gothic_New({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

// ブラウザのタブに出るタイトル
export const metadata: Metadata = {
  title: "Giftia",
  description: "贈る相手とシーンから選べるギフト専門ストア（学習用ダミーサイト）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 日本語サイトなので lang="ja"。2つのフォントの変数を、全ページに渡す
    <html lang="ja" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
