'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PersonaModelType } from '@/providers/settings-provider';
import { useSettingsStore } from '@/store/settings-store';
import { BarChart2, Check, Search, Settings } from 'lucide-react';
import { useState } from 'react';

export function SettingsDialog() {
  const [activeTab, setActiveTab] = useState('general');

  // Use settings store
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);

  // Destructure state
  const {
    filterZeroVolume,
    maxResults,
    useAlphabet,
    useSymbols,
    personaModel
  } = settingsState;

  // Destructure actions
  const {
    setFilterZeroVolume,
    setMaxResults,
    setUseAlphabet,
    setUseSymbols,
    setPersonaModel
  } = settingsActions;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="sr-only">設置</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            應用程式設定
          </DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="general"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-2"
        >
          <TabsList className="grid grid-cols-1 mb-4">
            <TabsTrigger value="search" className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              <span>搜索選項</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="settingsUseAlphabet"
                  checked={useAlphabet}
                  onCheckedChange={setUseAlphabet}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="settingsUseAlphabet"
                    className="text-sm font-medium cursor-pointer"
                  >
                    包含字母 (用於關鍵字建議)
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    自動添加 A-Z 字母到關鍵字建議中
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="settingsUseSymbols"
                  checked={useSymbols}
                  onCheckedChange={setUseSymbols}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="settingsUseSymbols"
                    className="text-sm font-medium cursor-pointer"
                  >
                    包含符號 (用於關鍵字建議)
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    自動添加常用符號到關鍵字建議中
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="filter-zero"
                  checked={filterZeroVolume}
                  onCheckedChange={checked =>
                    setFilterZeroVolume(checked as boolean)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="filter-zero"
                    className="text-sm font-medium cursor-pointer"
                  >
                    過濾零搜索量關鍵字
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    自動過濾沒有搜索量的關鍵字
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="max-results" className="text-sm font-medium">
                    最大結果數
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      ({maxResults} 個關鍵字)
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    id="max-results"
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={maxResults}
                    onChange={e =>
                      setMaxResults(Number.parseInt(e.target.value))
                    }
                    className="cursor-pointer w-full accent-blue-500"
                  />
                  <span className="text-sm font-medium w-8 text-center">
                    {maxResults}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  限制獲取搜索量時使用的關鍵字數量，數量越多API消耗越大
                </p>
              </div>

              {/* --- Add Persona Model Setting --- */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="persona-model" className="text-sm font-medium">
                  用戶畫像生成模型
                </Label>
                <Select
                  value={personaModel}
                  onValueChange={value =>
                    setPersonaModel(value as PersonaModelType)
                  }
                >
                  <SelectTrigger id="persona-model" className="w-full">
                    <SelectValue placeholder="選擇模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">
                      GPT-4o-mini (推薦)
                    </SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (最佳質量)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  選擇用於生成用戶畫像的 AI 模型。不同模型的效果和成本可能不同。
                </p>
              </div>
              {/* --- End Persona Model Setting --- */}
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-sm text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50">
              <p className="flex items-start">
                <BarChart2 className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                搜索選項會影響關鍵字建議的數量和質量。請根據您的需求調整這些設置。
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-4">
          <DialogClose asChild>
            <Button variant="outline" className="gap-1.5">
              <Check className="h-4 w-4" />
              完成
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
