import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sailing Tactics — 세일링 전술 보드",
  description:
    "칠판 위 세일보트로 경기 흐름을 매직 트랜지션처럼 보여주며 전략·전술을 설명하는 보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
