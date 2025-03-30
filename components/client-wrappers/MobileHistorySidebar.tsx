'use client';

import SearchHistory from "@/components/SearchHistory";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Clock } from "lucide-react";
import { useState } from "react";

export default function MobileHistorySidebar() {
  const [open, setOpen] = useState(false);

  // 在客戶端組件內處理歷史記錄的選擇
  const handleSelectHistory = (historyDetail: any) => {
    // 使用客戶端事件來通知系統歷史記錄被選擇
    const event = new CustomEvent('history-selected', { 
      detail: historyDetail 
    });
    document.dispatchEvent(event);
    
    // 選擇歷史記錄後關閉側邊欄
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors fixed bottom-4 right-4 h-12 w-12 flex items-center justify-center"
          size="icon"
          aria-label="顯示搜索歷史"
        >
          <Clock className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[85vw] sm:w-80">
        <SearchHistory onSelectHistory={handleSelectHistory} />
      </SheetContent>
    </Sheet>
  );
} 