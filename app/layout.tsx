import GlobalLoadingOverlay from "@/components/common/GlobalLoadingOverlay"
import { SettingsProvider } from "@/providers/SettingsProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"
import type { Metadata, Viewport } from "next"
import { Inter, Roboto } from "next/font/google"
import type React from "react"
import { Toaster as SonnerToaster } from "sonner"
import Link from "next/link"
import { FileText } from "lucide-react"
import { SettingsDialog } from "@/components/settings-tool/SettingsDialog"
import { ModeToggle } from "@/components/common/ModeToggle"
import SettingBar from "@/components/settings-tool/SettingBar"
import "./globals.css"

// 使用 Inter 作为主要字体
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

// 使用 Roboto 作为次要字体（接近Apple风格）
const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Keyword Killer - 專業關鍵詞研究工具",
  description: "強大的SEO關鍵詞研究工具，分析搜索量、競爭度，獲取語義分群見解。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Keyword Killer"
  },
}

// 添加視口配置
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" }
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} ${roboto.variable} font-sans bg-background text-foreground antialiased min-h-screen overflow-x-hidden`}>
        <ThemeProvider>
          <SettingsProvider>
            <div className="flex flex-col h-full w-full">
              <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 bg-background border-b px-4">
                <div className="flex items-center gap-6">
                  <Link href="/tools/keyword" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">關鍵詞研究</span>
                  </Link>
                  <nav className="md:flex items-center gap-4">
                    <Link 
                      href="/tools/keyword" 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      新研究
                    </Link>
                    <Link 
                      href="/history" 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      歷史記錄
                    </Link>
                  </nav>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <SettingBar />
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
                borderLeft: "4px solid hsl(var(--primary))",
                borderRadius: "0.5rem",
                boxShadow: "var(--shadow-sm)",
              },
              className: "sm:max-w-[356px] max-w-[90vw]",
            }}
            closeButton={false}
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

