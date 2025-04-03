"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePastQueryStore } from "@/store/pastQueryStore"
import { useTabStore } from "@/store/tabStore"
import { BookOpen, ChevronLeft, FileText, Globe, LayoutGrid, Search } from "lucide-react"
import { useEffect, useState } from "react"

interface RightSidebarProps {
  isOpen: boolean
  onToggle: () => void
  children?: React.ReactNode
}

export function RightSidebar({ isOpen, onToggle, children }: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"docs" | "results">("docs")
  const { activeTab: globalActiveTab } = useTabStore((store) => store.state)
  const { selectedHistoryDetail } = usePastQueryStore((store) => store.state)

  // Switch to results tab when SERP results are available
  useEffect(() => {
    if (globalActiveTab === "serp" && selectedHistoryDetail?.searchResults) {
      setActiveTab("results")
    }
  }, [globalActiveTab, selectedHistoryDetail])

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-0 h-8 w-4 rounded-l-md bg-white dark:bg-gray-900 border border-r-0 border-gray-200 dark:border-gray-800"
        onClick={onToggle}
        title="展開側邊欄"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
      </Button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="py-3 px-4 border-b border-gray-100 dark:border-gray-800">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "docs" | "results")}>
          <div className="flex items-center justify-between mb-2">
            <TabsList className="h-8">
              <TabsTrigger value="docs" className="text-xs px-2.5 py-1 h-7 data-[state=active]:bg-blue-500">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                使用指南
              </TabsTrigger>
              <TabsTrigger value="results" className="text-xs px-2.5 py-1 h-7 data-[state=active]:bg-blue-500">
                <Search className="h-3.5 w-3.5 mr-1.5" />
                搜索結果
              </TabsTrigger>
            </TabsList>

            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={onToggle} title="收起側邊欄">
              <ChevronLeft className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
            </Button>
          </div>

          <TabsContent value="docs" className="mt-0">
            <div className="flex-grow overflow-y-auto">
              <div className="space-y-5 p-2">
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                    關鍵詞工具
                  </h3>
                  <ul className="space-y-1 text-sm pl-5">
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      搜索關鍵詞
                    </li>
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      獲取搜索量
                    </li>
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      語意分群
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                    <Globe className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                    URL 分析
                  </h3>
                  <ul className="space-y-1 text-sm pl-5">
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      分析網頁
                    </li>
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      提取關鍵詞
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                    <LayoutGrid className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                    SERP 分析
                  </h3>
                  <ul className="space-y-1 text-sm pl-5">
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      分析搜索結果
                    </li>
                    <li className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                      競爭分析
                    </li>
                  </ul>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">快捷鍵</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 mr-1.5">
                        Ctrl+Enter
                      </kbd>
                      <span className="text-gray-600 dark:text-gray-400">執行搜索</span>
                    </div>
                    <div className="flex items-center">
                      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-800 dark:text-gray-200 mr-1.5">
                        Esc
                      </kbd>
                      <span className="text-gray-600 dark:text-gray-400">清除結果</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="mt-0 h-[calc(100vh-6rem)] overflow-y-auto">
            {children ? (
              children
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Search className="h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">尚無搜索結果可顯示</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">請先進行搜索以查看結果</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

