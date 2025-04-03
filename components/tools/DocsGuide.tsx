"use client"

import type React from "react"

import { BookOpen, ChevronDown, ChevronRight, FileText, Globe, LayoutGrid, Settings } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface GuideSection {
  title: string
  icon: React.ReactNode
  items: { title: string; href: string }[]
}

export default function DocsGuide() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "keyword-tool": true,
  })

  const guideSections: GuideSection[] = [
    {
      title: "關鍵詞工具",
      icon: <FileText className="h-4 w-4" />,
      items: [
        { title: "搜索關鍵詞", href: "#keyword-search" },
        { title: "獲取搜索量", href: "#keyword-volume" },
        { title: "語意分群", href: "#keyword-clustering" },
      ],
    },
    {
      title: "URL 分析",
      icon: <Globe className="h-4 w-4" />,
      items: [
        { title: "分析網頁", href: "#url-analysis" },
        { title: "提取關鍵詞", href: "#url-keywords" },
      ],
    },
    {
      title: "SERP 分析",
      icon: <LayoutGrid className="h-4 w-4" />,
      items: [
        { title: "分析搜索結果", href: "#serp-analysis" },
        { title: "競爭分析", href: "#serp-competition" },
        { title: "HTML 分析", href: "#serp-html" },
      ],
    },
    {
      title: "設置",
      icon: <Settings className="h-4 w-4" />,
      items: [
        { title: "地區和語言", href: "#settings-region" },
        { title: "搜索選項", href: "#settings-search" },
      ],
    },
  ]

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="py-3 px-4 flex items-center">
        <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">使用指南</h2>
      </div>

      <div className="flex-grow overflow-y-auto px-2 pb-2">
        <div className="space-y-1">
          {guideSections.map((section) => {
            const sectionId = section.title.toLowerCase().replace(/\s+/g, "-")
            const isExpanded = expandedSections[sectionId]

            return (
              <div key={sectionId} className="rounded-md overflow-hidden">
                <button
                  onClick={() => toggleSection(sectionId)}
                  className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                  )}
                  {section.icon}
                  <span className="ml-2">{section.title}</span>
                </button>

                {isExpanded && (
                  <div className="ml-4 pl-4 border-l border-gray-200 dark:border-gray-800 space-y-1 py-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="py-2 px-4 border-t border-gray-200 dark:border-gray-800">
        <a
          href="#full-documentation"
          className="flex items-center justify-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          查看完整文檔
        </a>
      </div>
    </div>
  )
}

