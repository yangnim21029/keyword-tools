"use client"

import type { KeywordVolumeItem } from "@/lib/schemas"
import { BarChart2, Tag } from "lucide-react"
import { memo } from "react"

interface KeywordCardProps {
  item: KeywordVolumeItem
  onClick: (text: string) => void
  clusterName?: string
}

const KeywordCard = memo(({ item, onClick, clusterName }: KeywordCardProps) => {
  // Determine volume class based on search volume
  const getVolumeClass = () => {
    if (!item.searchVolume) return "text-gray-500"
    if (item.searchVolume > 1000) return "text-green-600 font-medium"
    if (item.searchVolume > 100) return "text-blue-600"
    return "text-gray-600"
  }

  return (
    <div
      className="flex items-center py-2 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-md cursor-pointer group"
      onClick={() => onClick(item.text || "")}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]">{item.text}</span>
          {clusterName && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap text-[10px] sm:text-xs max-w-[100px] sm:max-w-full truncate">
              <Tag className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{clusterName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {/* 搜索量 */}
          <span className={`text-xs flex items-center ${getVolumeClass()}`}>
            <BarChart2 className="h-3 w-3 mr-0.5 opacity-70 flex-shrink-0" />
            {item.searchVolume !== undefined && item.searchVolume !== null
              ? new Intl.NumberFormat().format(item.searchVolume)
              : "無數據"}
          </span>

          {/* CPC */}
          {item.cpc && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              ${typeof item.cpc === "number" ? item.cpc.toFixed(2) : item.cpc}
            </span>
          )}

          {/* 競爭度 */}
          {item.competition && (
            <span
              className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                item.competition.toLowerCase() === "low"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : item.competition.toLowerCase() === "medium"
                    ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}
            >
              {item.competition}
            </span>
          )}
        </div>
      </div>

      <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded hidden sm:inline-block">
        複製
      </span>
    </div>
  )
})

KeywordCard.displayName = "KeywordCard"

export default KeywordCard

