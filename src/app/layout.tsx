import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Jua } from "next/font/google";
import "./globals.css";

// 한글 글자는 subsets 목록에 없지만 unicode-range로 나뉜 파일이 필요할 때 받아집니다. 미리 받기는 라틴만.
const jua = Jua({
  variable: "--font-jua",
  weight: "400",
  subsets: ["latin"],
});

const plex = IBM_Plex_Sans_KR({
  variable: "--font-plex",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "딕으닥",
  description: "허밍 한 소절을 밴드곡으로",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${jua.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
