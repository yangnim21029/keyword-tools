"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 只在客戶端渲染後加載，避免 SSR 水合問題
  useEffect(() => {
    setMounted(true);
  }, []);

  // 當前主題是否為暗色模式
  const isDarkMode =
    mounted &&
    (theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-9 w-9 rounded-full relative transition-all duration-200 ${
            isDarkMode
              ? "border-gray-800 bg-gray-900 shadow-sm hover:bg-gray-800"
              : "border-gray-200 shadow-sm hover:bg-gray-50"
          }`}
        >
          {mounted ? (
            <>
              <Sun
                className={`h-[1.1rem] w-[1.1rem] text-amber-500 transition-all duration-300 ease-in-out ${
                  isDarkMode ? "opacity-0 scale-0" : "opacity-100 scale-100"
                }`}
              />
              <Moon
                className={`absolute h-[1.1rem] w-[1.1rem] text-blue-400 transition-all duration-300 ease-in-out ${
                  isDarkMode ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
              />
            </>
          ) : (
            // 使用固定圖標在 SSR 期間顯示，防止閃爍
            <Sun className="h-[1.1rem] w-[1.1rem] text-amber-500" />
          )}
          <span className="sr-only">切換主題</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`border rounded-lg ${
          isDarkMode
            ? "border-gray-800 bg-gray-900 shadow-md"
            : "border-gray-200 shadow-md"
        }`}
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`flex items-center gap-2 cursor-pointer ${
            isDarkMode
              ? "hover:bg-gray-800 focus:bg-gray-800"
              : "hover:bg-gray-50 focus:bg-gray-50"
          } ${theme === "light" ? (isDarkMode ? "bg-gray-800" : "bg-gray-100") : ""}`}
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span className={theme === "light" ? "font-medium" : ""}>
            淺色模式
          </span>
          {theme === "light" && (
            <span className="ml-auto text-blue-500">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-2 cursor-pointer ${
            isDarkMode
              ? "hover:bg-gray-800 focus:bg-gray-800"
              : "hover:bg-gray-50 focus:bg-gray-50"
          } ${theme === "dark" ? (isDarkMode ? "bg-gray-800" : "bg-gray-100") : ""}`}
        >
          <Moon className="h-4 w-4 text-blue-400" />
          <span className={theme === "dark" ? "font-medium" : ""}>
            深色模式
          </span>
          {theme === "dark" && <span className="ml-auto text-blue-500">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`flex items-center gap-2 cursor-pointer ${
            isDarkMode
              ? "hover:bg-gray-800 focus:bg-gray-800"
              : "hover:bg-gray-50 focus:bg-gray-50"
          } ${theme === "system" ? (isDarkMode ? "bg-gray-800" : "bg-gray-100") : ""}`}
        >
          <svg
            className="h-4 w-4 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span className={theme === "system" ? "font-medium" : ""}>
            系統設定
          </span>
          {theme === "system" && (
            <span className="ml-auto text-blue-500">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
