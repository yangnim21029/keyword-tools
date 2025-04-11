"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { FileText, Search } from "lucide-react"
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">{description}</p>

      {actionLabel && onAction && (
        <Button onClick={onAction} className="mb-4">
          {actionLabel}
        </Button>
      )}

      {showToolLinks && (
        <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
          <Link
            href="/tools/keyword"
            className="flex items-center justify-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <FileText className="h-4 w-4 text-blue-500" />
            關鍵詞工具
          </Link>
        </div>
      )}
    </div>
  )
}

