import { Badge } from "@/components/ui/badge"
import type React from "react"
import { SearchShortcutHelp } from "../../../components/tools/SearchShortcutHelp"

interface ToolHeaderProps {
  title: string
  description: string
  region?: string
  language?: string
  icon?: React.ReactNode
}

export function ToolHeader({ title, description, region, language, icon }: ToolHeaderProps) {
  return (
    <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>

        {/* Display region and language if provided */}
        {(region || language) && (
          <div className="flex items-center gap-2 mt-1">
            {region && (
              <Badge variant="outline" className="text-xs">
                地區: {region}
              </Badge>
            )}
            {language && (
              <Badge variant="outline" className="text-xs">
                語言: {language.replace("_", "-")}
              </Badge>
            )}
          </div>
        )}
      </div>

      <SearchShortcutHelp />
    </div>
  )
}

