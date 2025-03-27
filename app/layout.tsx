import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import "./globals.css";

// 使用 Inter 作为主要字体
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// 使用 Roboto 作为次要字体（接近Apple风格）
const roboto = Roboto({ 
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Keyword Killer - SEO 關鍵詞研究工具",
  description: "專業的 SEO 關鍵詞研究和分析工具，幫助您找到最佳搜尋引擎優化策略",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" data-theme="light">
      <body className={`${inter.variable} ${roboto.variable}`}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-grow bg-base-100">
            <div className="flex h-screen overflow-hidden">
              {/* 左侧历史记录栏 - 固定宽度，全高 */}
              <div id="search-history-container" className="flex-none w-64 border-r border-gray-200 overflow-hidden hidden md:block">
                {/* SearchHistory 组件将在 page.tsx 中使用客户端组件方式渲染到这里 */}
              </div>
              
              {/* 主内容区域 - 可滚动 */}
              <div className="flex-grow overflow-y-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
