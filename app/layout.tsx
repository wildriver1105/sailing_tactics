import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sailing Tactics — 세일링 전술 보드",
  description:
    "칠판 위 세일보트로 경기 흐름을 매직 트랜지션처럼 보여주며 전략·전술을 설명하는 보드",
};

// iPad/iOS: 노치·홈 인디케이터 영역까지 화면을 채우고(env safe-area 활용),
// 확대/축소를 막아 네이티브 앱처럼 동작하게 한다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1f1c",
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
