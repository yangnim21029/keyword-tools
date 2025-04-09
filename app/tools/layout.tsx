"use client"

import { ModeToggle } from "@/components/common/ModeToggle"
import { SearchShortcutHelp } from "@/components/tools/SearchShortcutHelp"
import { SettingsDialog } from "@/components/tools/SettingsDialog"
import { FileText, History } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LayoutWidthContext } from '@/providers/LayoutWidthProvider';

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const contentRef = useRef<HTMLDivElement>(null);
  const [isWideLayout, setIsWideLayout] = useState(true);
  const WIDTH_THRESHOLD = 768;

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setIsWideLayout(width >= WIDTH_THRESHOLD);
      }
    });

    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    if (contentRef.current) {
       setIsWideLayout(contentRef.current.offsetWidth >= WIDTH_THRESHOLD);
    }

    return () => observer.disconnect();
  }, []);

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">

      <LayoutWidthContext.Provider value={{ isWideLayout }}>
        <div ref={contentRef} className="flex-1 w-full overflow-auto p-4">
          {children}
        </div>
      </LayoutWidthContext.Provider>
    </div>
  )
}

