"use client"

import { useIsMobile } from "@/hooks/UseMobile"
import { cn } from "@/lib/utils"
import { FileText, Home, PanelLeft, PanelRight, Search } from "lucide-react"
import React from "react"

interface MobileNavbarProps {
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
}

export default function MobileNavbar({
  onToggleLeftSidebar,
  onToggleRightSidebar
}: MobileNavbarProps) {
  const isMobile = useIsMobile()
  
  // 如果不是移动设备，不显示底部导航
  if (!isMobile) return null
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="grid grid-cols-5 h-16">
        <NavButton 
          icon={<PanelLeft className="h-5 w-5" />} 
          label="左側欄"
          onClick={onToggleLeftSidebar}
        />
        
        <NavButton 
          icon={<FileText className="h-5 w-5" />} 
          label="關鍵詞"
          href="/tools/keyword"
        />
        
        <NavButton 
          icon={<Home className="h-5 w-5" />} 
          label="首頁"
          href="/"
        />
        
        <NavButton 
          icon={<Search className="h-5 w-5" />} 
          label="搜索"
          href="/tools/serp"
        />
        
        <NavButton 
          icon={<PanelRight className="h-5 w-5" />} 
          label="右側欄"
          onClick={onToggleRightSidebar}
        />
      </div>
    </div>
  )
}

interface NavButtonProps {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  href?: string
  className?: string
}

function NavButton({ icon, label, onClick, href, className }: NavButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (href) {
      window.location.href = href
    }
  }
  
  return (
    <button
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      onClick={handleClick}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
} 