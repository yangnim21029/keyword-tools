import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HelpCircle, Keyboard } from "lucide-react"

export function SearchShortcutHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <HelpCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="sr-only">搜索幫助</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-blue-500" />
            搜索快捷鍵和提示
          </DialogTitle>
          <DialogDescription>使用這些快捷鍵和提示來提高您的搜索效率。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">快捷鍵</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">Ctrl+Enter</kbd>
                <span>執行搜索</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">Enter</kbd>
                <span>在輸入框中按 Enter 執行搜索</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs">Esc</kbd>
                <span>清除搜索結果</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">搜索提示</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <li>使用精確的關鍵詞以獲得更相關的結果</li>
              <li>URL 分析需要完整的 URL，包括 http:// 或 https://</li>
              <li>SERP 分析支持多個關鍵詞，每行一個</li>
              <li>搜索結果會自動保存到歷史記錄中</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">工具說明</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 min-w-[80px]">關鍵詞工具:</span>
                <span className="text-gray-700 dark:text-gray-300">查找相關關鍵詞並獲取搜索量數據</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 min-w-[80px]">URL 分析:</span>
                <span className="text-gray-700 dark:text-gray-300">從網頁中提取關鍵詞並分析其搜索量</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 min-w-[80px]">SERP 分析:</span>
                <span className="text-gray-700 dark:text-gray-300">分析搜索結果頁面，了解競爭情況</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

