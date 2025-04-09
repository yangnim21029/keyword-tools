import { Badge } from "@/components/ui/badge"
import type React from "react"
import { SearchShortcutHelp } from "../../../components/tools/SearchShortcutHelp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface ToolHeaderProps {
  title: string
  description: string
  region?: string
  language?: string
  icon?: React.ReactNode
  showBackButton?: boolean
}

export function ToolHeader({ title, description, region, language, icon, showBackButton = true }: ToolHeaderProps) {
  return (
    <Card className="mb-6">
      {(description || region || language) && (
        <CardContent>
          {description && (
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
          )}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {region && <span>地區: {region}</span>}
            {language && <span>語言: {language}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

