/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 정적 익스포트: `next build` → ./out (Tauri가 번들로 서빙).
  // 앱이 전부 클라이언트 사이드라 깨끗하게 익스포트됨.
  output: "export",
  // 이미지 최적화 API는 서버가 필요하므로 비활성화.
  images: { unoptimized: true },
};

export default nextConfig;
