import { Badge } from "@/components/ui/badge"
import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
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

export function ToolHeader({ 
  title, 
  description, 
  region, 
  language, 
  icon, 
  showBackButton = true 
}: ToolHeaderProps) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4 mb-4">
          {showBackButton && (
            <Link href="/tools/keyword">
              <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            {icon}
            <h1 className="text-2xl font-semibold">{title}</h1>
          </div>
        </div>
        {(description || region || language) && (
          <div>
            {description && (
              <p className="text-sm text-muted-foreground mb-2">{description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {region && <Badge variant="outline">地區: {region}</Badge>}
              {language && <Badge variant="outline">語言: {language}</Badge>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

