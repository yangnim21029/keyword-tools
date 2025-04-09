"use client"

import { useRef, useState, useEffect } from "react"
import type React from "react"
import { LayoutWidthContext } from '@/providers/LayoutWidthProvider'

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isWideLayout, setIsWideLayout] = useState(true);
  const WIDTH_THRESHOLD = 768;

  useEffect(() => {
    const updateLayoutWidth = () => {
      if (contentRef.current) {
        setIsWideLayout(contentRef.current.offsetWidth >= WIDTH_THRESHOLD);
      }
    };

    // Initial check
    updateLayoutWidth();

    // Add resize listener
    window.addEventListener('resize', updateLayoutWidth);
    return () => window.removeEventListener('resize', updateLayoutWidth);
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

