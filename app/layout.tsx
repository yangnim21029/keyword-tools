import GlobalLoadingOverlay from "@/components/common/GlobalLoadingOverlay"
import { PastQueryProvider } from "@/providers/PastQueryProvider"
import { QueryProvider } from "@/providers/QueryProvider"
import { SettingsProvider } from "@/providers/SettingsProvider"
import { TabProvider } from "@/providers/TabProvider"
import { ThemeProvider } from "@/providers/ThemeProvider"
import type { Metadata } from "next"
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
  title: "Keyword Killer - Professional Keyword Research Tool",
  description:
    "A powerful keyword research tool for SEO professionals. Analyze search volumes, competition, and get semantic clustering insights.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} ${roboto.variable} bg-background text-foreground antialiased`}>
        <ThemeProvider>
          <SettingsProvider>
            <TabProvider>
              <QueryProvider>
                <PastQueryProvider>
                  {/* Use client component for interactive sidebar */}
                  <ClientLayout>{children}</ClientLayout>

                  {/* Global loading overlay */}
                  <GlobalLoadingOverlay />
                </PastQueryProvider>
              </QueryProvider>
            </TabProvider>
          </SettingsProvider>
          <SonnerToaster
            position="top-right"
            expand={false}
            visibleToasts={6}
            toastOptions={{
              duration: 6000,
              style: {
                borderLeft: "4px solid #3b82f6",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                maxWidth: "350px",
              },
            }}
            closeButton
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

