import GlobalLoadingOverlay from "@/components/common/GlobalLoadingOverlay"
import { ResearchProvider } from "@/providers/keywordResearchProvider"
import { QueryProvider } from "@/providers/QueryProvider"
import { SettingsProvider } from "@/providers/SettingsProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"
import type { Metadata, Viewport } from "next"
import { Inter, Roboto } from "next/font/google"
import type React from "react"
import { Toaster as SonnerToaster } from "sonner"
import ClientLayout from "./ClientLayout"
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
            <QueryProvider>
              <ResearchProvider>
                <ClientLayout>{children}</ClientLayout>
                <GlobalLoadingOverlay />
              </ResearchProvider>
            </QueryProvider>
          </SettingsProvider>
          <SonnerToaster
            position="bottom-right"
            expand={false}
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
            closeButton
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

