"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { FileText, Globe, LayoutGrid, Search } from "lucide-react"
import Link from "next/link"

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  showToolLinks?: boolean
}

export function EmptyState({
  title,
  description,
  icon = <Search className="h-12 w-12 text-gray-300 dark:text-gray-700" />,
  actionLabel,
  onAction,
  showToolLinks = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">{description}</p>

      {actionLabel && onAction && (
        <Button onClick={onAction} className="mb-4">
          {actionLabel}
        </Button>
      )}

      {showToolLinks && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-lg">
          <Link
            href="/tools/keyword"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <FileText className="h-4 w-4 text-blue-500" />
            關鍵詞工具
          </Link>
          <Link
            href="/tools/url"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Globe className="h-4 w-4 text-green-500" />
            URL 分析
          </Link>
          <Link
            href="/tools/serp"
            className="flex items-center justify-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <LayoutGrid className="h-4 w-4 text-purple-500" />
            SERP 分析
          </Link>
        </div>
      )}
    </div>
  )
}

