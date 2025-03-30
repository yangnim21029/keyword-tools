import HistorySidebar from "@/components/client-wrappers/HistorySidebar";
import GlobalLoadingOverlay from "@/components/common/GlobalLoadingOverlay";
import { HistoryProvider } from '@/providers/history-provider';
import { SearchProvider } from '@/providers/search-provider';
import { SettingsProvider } from '@/providers/settings-provider';
import { TabProvider } from '@/providers/tab-provider';
import { ThemeProvider } from "@/providers/theme-provider";
import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import { Toaster as SonnerToaster } from "sonner";
import "./globals.css";

// 使用 Inter 作为主要字体
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// 使用 Roboto 作为次要字体（接近Apple风格）
const roboto = Roboto({ 
  weight: ['300', '400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "关键词杀手",
  description: "关键词工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} ${roboto.variable} bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SettingsProvider>
            <TabProvider>
              <SearchProvider>
                <HistoryProvider>
                  <div className="flex min-h-screen max-h-screen overflow-hidden bg-background">
                    {/* 搜索歷史側邊欄 - 固定寬度，全高 */}
                    <aside className="hidden md:block w-64 lg:w-72 border-r border-gray-200 dark:border-gray-800 bg-card shadow-sm flex-shrink-0 h-screen">
                      <HistorySidebar />
                    </aside>
                      
                    {/* 主內容區域 - 獨立滾動 */}
                    <main className="flex-grow h-screen overflow-auto relative">
                      {children}
                      
                      {/* 行動裝置顯示搜索歷史的按鈕 */}
                      <div className="md:hidden fixed bottom-4 right-4 z-50">
                        <button 
                          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
                          aria-label="顯示搜索歷史"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    </main>
                  </div>
                  
                  {/* 全局加載遮罩 */}
                  <GlobalLoadingOverlay />
                </HistoryProvider>
              </SearchProvider>
            </TabProvider>
          </SettingsProvider>
          <SonnerToaster 
            position="top-right"
            expand={false}
            visibleToasts={6}
            toastOptions={{
              duration: 6000,
              style: {
                borderLeft: '4px solid #3b82f6',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                maxWidth: '350px'
              }
            }}
            closeButton
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
