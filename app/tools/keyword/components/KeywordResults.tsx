"use client"

import { Button } from "@/components/ui/button"
import type { KeywordVolumeItem } from "@/lib/schemas"
import type { SortState } from "@/types/keywordTool.d"
import { ArrowDown, ArrowUp, BarChart2 } from "lucide-react"
import { useMemo } from "react"
import KeywordCard from "./KeywordCard"

interface KeywordResultsProps {
  volumeData: KeywordVolumeItem[]
  sortState: SortState
  filterZeroVolume: boolean
  maxResults: number
  onKeywordClick: (text: string) => void
  onSort?: (field: any) => void
}

export default function KeywordResults({
  volumeData,
  sortState,
  filterZeroVolume,
  maxResults,
  onKeywordClick,
  onSort,
}: KeywordResultsProps) {
  // Filter and sort volume data
  const filteredVolumeData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) {
      return []
    }

    // Define unified function to handle competition values
    const getCompetitionValue = (comp: string | number | undefined): number => {
      if (comp === undefined || comp === null) return 2 // Default to medium for missing data

      // Handle string values (case-insensitive)
      if (typeof comp === "string") {
        const compLower = comp.toLowerCase()
        if (compLower === "low" || compLower === "低") return 1
        if (compLower === "medium" || compLower === "中") return 2
        if (compLower === "high" || compLower === "高") return 3
        // Attempt to parse string as number if it doesn't match known terms
        const numComp = Number.parseFloat(comp)
        if (!isNaN(numComp))
          comp = numComp // If parseable, treat as number below
        else return 2 // Default if string is unrecognizable
      }

      // Handle numeric values (assuming 0-100 range mapping or direct 1,2,3)
      if (typeof comp === "number") {
        if (comp === 1 || comp <= 33) return 1 // Low
        if (comp === 2 || (comp > 33 && comp <= 66)) return 2 // Medium
        if (comp === 3 || comp > 66) return 3 // High
      }

      return 2 // Default fallback
    }

    // Filter based on filterZeroVolume prop
    const filteredData = filterZeroVolume
      ? volumeData.filter((item) => item.searchVolume != null && item.searchVolume > 0)
      : [...volumeData] // Create a shallow copy for sorting if not filtering

    // Sort based on sortState
    filteredData.sort((a: KeywordVolumeItem, b: KeywordVolumeItem) => {
      const { field, direction } = sortState

      // Handle potentially missing fields or null/undefined values
      const valA = a[field as keyof KeywordVolumeItem]
      const valB = b[field as keyof KeywordVolumeItem]

      // Place items with null/undefined values at the end
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      // Special handling for competition field
      if (field === "competition") {
        const compA = getCompetitionValue(valA as string | number | undefined)
        const compB = getCompetitionValue(valB as string | number | undefined)
        return direction === "asc" ? compA - compB : compB - compA
      }

      // Handle numeric fields (like searchVolume, cpc)
      if (typeof valA === "number" && typeof valB === "number") {
        return direction === "asc" ? valA - valB : valB - valA
      }

      // Handle string fields (like text/keyword)
      if (typeof valA === "string" && typeof valB === "string") {
        return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      // Fallback comparison (shouldn't be reached often with typed items)
      return 0
    })

    return filteredData
  }, [volumeData, filterZeroVolume, sortState])

  if (filteredVolumeData.length === 0) {
    return <div className="text-center p-4 text-gray-500 dark:text-gray-400">沒有找到相關數據</div>
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 dark:border-gray-800 p-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
          <BarChart2 className="h-4 w-4 mr-1.5 text-blue-500" />
          關鍵詞搜索量 ({filteredVolumeData.length})
        </h3>

        {onSort && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs flex items-center gap-1"
              onClick={() => onSort("text")}
            >
              名稱
              {sortState.field === "text" &&
                (sortState.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs flex items-center gap-1"
              onClick={() => onSort("searchVolume")}
            >
              搜索量
              {sortState.field === "searchVolume" &&
                (sortState.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </Button>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
        {filteredVolumeData.slice(0, maxResults).map((item, index) => (
          <KeywordCard key={item.text || index} item={item} index={index} onClick={onKeywordClick} />
        ))}
      </div>
    </div>
  )
}

