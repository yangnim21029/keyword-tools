"use client"

import type { KeywordVolumeItem } from "@/lib/schemas"
import { BarChart2 } from "lucide-react"
import { memo } from "react"

interface KeywordCardProps {
  item: KeywordVolumeItem
  index: number
  onClick: (text: string) => void
}

const KeywordCard = memo(({ item, index, onClick }: KeywordCardProps) => {
  // Determine volume class based on search volume
  const getVolumeClass = () => {
    if (!item.searchVolume) return "text-gray-500 dark:text-gray-400"
    if (item.searchVolume > 1000) return "text-green-600 dark:text-green-400 font-medium"
    if (item.searchVolume > 100) return "text-blue-600 dark:text-blue-400"
    return "text-gray-600 dark:text-gray-400"
  }

  return (
    <div
      className="flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-md cursor-pointer transition-colors group"
      onClick={() => onClick(item.text || "")}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{item.text}</span>
        </div>

        <div className="flex items-center gap-3 mt-0.5">
          <span className={`text-xs flex items-center ${getVolumeClass()}`}>
            <BarChart2 className="h-3 w-3 mr-1 opacity-70" />
            {item.searchVolume !== undefined && item.searchVolume !== null
              ? new Intl.NumberFormat().format(item.searchVolume)
              : "無數據"}
          </span>

          {item.cpc && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              ${typeof item.cpc === "number" ? item.cpc.toFixed(2) : item.cpc}
            </span>
          )}

          {item.competition && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
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

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
          複製
        </span>
      </div>
    </div>
  )
})

KeywordCard.displayName = "KeywordCard"

export default KeywordCard

