"use client"

import { SettingsDialog } from "@/app/keyword-mapping/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BarChart, HelpCircle, List, Pen, Search, Settings, type LucideProps } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { type ForwardRefExoticComponent, type RefAttributes, useState } from "react";

type IconName = "search" | "help" | "pen" | "bar-chart" | "list" | "settings";

const iconMap: {
  [key in IconName]: ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
  >;
} = {
  search: Search,
  help: HelpCircle,
  pen: Pen,
  "bar-chart": BarChart,
  list: List,
  settings: Settings,
};

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

type SettingsItem = {
  label: string;
  icon: IconName;
};

interface NavigationProps {
  items: NavItem[];
  settingsItem: SettingsItem;
  className?: string;
}

export function Navigation({ items, settingsItem, className }: NavigationProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const allItems = [...items];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
        isExpanded ? "w-56" : "w-16",
        className,
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex h-14 items-center justify-center border-b px-2">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className={cn("sr-only", isExpanded && "sr-only-hidden")}>PL</span>
          <span className={cn("whitespace-nowrap", !isExpanded && "sr-only")}>
            Keyword Killer
          </span>
        </Link>
      </div>
      <nav className="flex flex-grow flex-col gap-1 px-2 py-4">
        <TooltipProvider delayDuration={0}>
          {allItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground",
                      isActive && "bg-muted text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                        isExpanded ? "w-auto opacity-100" : "w-0 opacity-0"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>
      <nav className="mt-auto flex flex-col gap-1 border-t px-2 py-4">
        <SettingsDialog
          trigger={
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-foreground",
                    )}
                    aria-label={settingsItem.label}
                  >
                    {React.createElement(iconMap[settingsItem.icon], { className: "h-5 w-5 flex-shrink-0" })}
                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                        isExpanded ? "w-auto opacity-100" : "w-0 opacity-0"
                      )}
                    >
                      {settingsItem.label}
                    </span>
                  </Button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right">
                    <p>{settingsItem.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          }
        />
      </nav>
    </aside>
  );
}
