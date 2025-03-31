'use client';

import { ModeToggle } from '@/components/common/ModeToggle';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Add reusable style class definition here or ensure it exists in globals.css
const tabTriggerClass = "text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm";

export default function HeaderControls() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <ModeToggle />
      <div className="backdrop-blur-sm p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm flex items-center">
        <Link
          href="/"
          className={cn(
            "text-sm font-medium px-4 py-1.5 rounded-full transition-colors",
            pathname === "/" 
              ? "bg-blue-500 text-white shadow-sm" 
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          關鍵詞工具
        </Link>
        <Link
          href="/url"
          className={cn(
            "text-sm font-medium px-4 py-1.5 rounded-full transition-colors",
            pathname === "/url" 
              ? "bg-blue-500 text-white shadow-sm" 
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          URL分析
        </Link>
        <Link
          href="/serp"
          className={cn(
            "text-sm font-medium px-4 py-1.5 rounded-full transition-colors",
            pathname === "/serp" 
              ? "bg-blue-500 text-white shadow-sm" 
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          SERP分析
        </Link>
      </div>
    </div>
  );
}
