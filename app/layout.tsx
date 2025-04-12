import { SettingsDialog } from '@/app/keyword-mapping/components/settings-dialog';
import GlobalLoadingOverlay from '@/components/common/global-loading-overlay';
import { ModeToggle } from '@/components/common/mode-toggle';
import { SettingsProvider } from '@/providers/settings-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto } from 'next/font/google';
import Link from 'next/link';
import type React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import './globals.css';

// 使用 Inter 作为主要字体
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// 使用 Roboto 作为次要字体（接近Apple风格）
const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'PressLogic 編輯專用找關鍵詞的工具',
  description: '輸入關鍵詞或網址以開始分析。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Keyword Killer'
  }
};

// 添加視口配置
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' }
  ]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${roboto.variable} font-sans bg-background text-foreground antialiased min-h-screen overflow-x-hidden`}
      >
        <ThemeProvider>
          <SettingsProvider>
            <div className="flex flex-col h-full w-full">
              <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 bg-background border-b px-4">
                <div className="flex items-center gap-6">
                  <Link
                    href="/keyword-mapping"
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <span className="font-medium">關鍵字工具</span>
                  </Link>
                  <nav className="md:flex items-center gap-4">
                    <Link
                      href="/keyword-mapping"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      新的
                    </Link>
                    <span className="text-xs text-muted-foreground/70">
                      v0.1.0
                    </span>
                  </nav>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-1">
                    <SettingsDialog />
                    <ModeToggle />
                  </div>
                </div>
              </header>
              <main className="flex-1 w-full overflow-auto p-4">
                {children}
              </main>
            </div>
            <GlobalLoadingOverlay />
          </SettingsProvider>
          <SonnerToaster
            position="bottom-right"
            expand={true}
            visibleToasts={6}
            toastOptions={{
              duration: 5000,
              style: {
                borderLeft: '4px solid hsl(var(--primary))',
                borderRadius: '0.5rem',
                boxShadow: 'var(--shadow-sm)'
              },
              className: 'sm:max-w-[356px] max-w-[90vw]'
            }}
            closeButton={false}
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
