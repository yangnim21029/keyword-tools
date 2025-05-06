"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Box,
  HelpCircle,
  List,
  Pen,
  Search,
  Settings,
  type LucideProps,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  type ForwardRefExoticComponent,
  type RefAttributes,
  useState,
  useMemo,
} from "react";
import { toast } from "sonner";
import {
  NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  type IconName,
  type NavItem,
  type SettingsItem,
} from "./global-config";

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
  box: Box,
};

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = useMemo(() => NAV_ITEMS, []);
  const settingsItem = useMemo(() => SETTINGS_NAV_ITEM, []);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
        isExpanded ? "w-56" : "w-16",
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex h-14 items-center justify-center border-b px-2">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className={cn("sr-only", isExpanded && "sr-only-hidden")}>
            PL
          </span>
          <span className={cn("whitespace-nowrap", !isExpanded && "sr-only")}>
            Keyword Tools
          </span>
        </Link>
      </div>
      <nav className="flex flex-grow flex-col gap-2 px-2 py-6">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 transition-all hover:text-foreground",
                      isActive
                        ? "bg-muted text-foreground"
                        : item.isPrimary
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span
                      className={cn(
                        "flex items-center gap-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                        isExpanded ? "w-auto opacity-100" : "w-0 opacity-0"
                      )}
                    >
                      {item.label}
                      {isExpanded && item.isPrimary && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-green-500"
                          aria-hidden="true"
                        />
                      )}
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
      <nav className="mt-auto flex flex-col gap-2 border-t px-2 py-6">
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-muted-foreground transition-all hover:text-foreground"
          )}
          aria-label={settingsItem.label}
          onClick={() => toast.info("施工中")}
        >
          {React.createElement(iconMap[settingsItem.icon], {
            className: "h-5 w-5 flex-shrink-0",
          })}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
              isExpanded ? "w-auto opacity-100" : "w-0 opacity-0"
            )}
          >
            {settingsItem.label}
          </span>
        </Button>
      </nav>
    </aside>
  );
}
