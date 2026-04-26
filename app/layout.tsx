import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify Recommender",
  description: "あなたのプレイリストを分析して、好みに合った音楽を発見",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-sp-dark text-white min-h-screen antialiased">{children}</body>
    </html>
  );
}
