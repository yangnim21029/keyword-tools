import { Badge } from "@/components/ui/badge"
import type React from "react"
import { SearchShortcutHelp } from "./SearchShortcutHelp"

interface ToolHeaderProps {
  title: string
  description: string
  activeTool: string
  region?: string
  language?: string
  icon?: React.ReactNode
}

export function ToolHeader({ title, description, activeTool, region, language, icon }: ToolHeaderProps) {
  return (
    <div className="mb-4 p-3 bg-white dark:bg-gray-950 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            {icon}
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{description}</p>

          {/* Display region and language if provided */}
          {(region || language) && (
            <div className="flex items-center gap-2 mt-1">
              {region && (
                <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900">
                  地區: {region}
                </Badge>
              )}
              {language && (
                <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900">
                  語言: {language.replace("_", "-")}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center">
          <SearchShortcutHelp />
        </div>
      </div>
    </div>
  )
}

