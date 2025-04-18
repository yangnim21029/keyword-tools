import { SettingsDialog } from '@/app/keyword-mapping/components/settings-dialog';
import GlobalLoadingOverlay from '@/components/common/global-loading-overlay';
import { SettingsProvider } from '@/providers/settings-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto } from 'next/font/google';
import type React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { BarChart, HelpCircle, List, Pen, Search, Settings } from 'lucide-react';
import './globals.css';
import { Navigation } from './global-navigation';

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
  title: 'PressLogic 編輯專用找關鍵字的工具',
  description: '輸入關鍵字或網址以開始分析。',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Keyword Killer'
  }
};

// 修改視口配置，移除暗黑模式的主題色
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: 'white'
};

// Define navigation items with icons
const navigationItems = [
  { href: '/keyword-mapping', label: '關鍵字工具', icon: 'search' as const },
  { href: '/help', label: '說明', icon: 'help' as const },
  { href: '/writing', label: 'Writing', icon: 'pen' as const },
  { href: '/dev', label: '各站成效', icon: 'bar-chart' as const },
  { href: '/serp', label: 'SERP 分析', icon: 'list' as const },
];

// Define settings item separately
const settingsItem = {
  // No href needed if it just opens a dialog
  label: '設定',
  icon: 'settings' as const
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
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <SettingsProvider>
            <Navigation items={navigationItems} settingsItem={settingsItem} />
            <main className="w-full overflow-auto p-4 pt-4 pl-20 min-h-screen">
              {children}
            </main>
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
            theme="light"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
