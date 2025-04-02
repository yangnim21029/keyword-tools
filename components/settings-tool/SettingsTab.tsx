'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/store/settingsStore";
import { Globe } from "lucide-react";

interface SettingsTabProps {
  // 移除所有 props
}

export default function SettingsTab() {
  // 使用 store 獲取狀態和操作方法
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);

  // 解構狀態
  const {
    filterZeroVolume,
    maxResults,
    region,
    language,
    regions,
    languages,
    useAlphabet,
    useSymbols
  } = settingsState;

  // 解構操作
  const {
    setFilterZeroVolume,
    setMaxResults,
    setRegion,
    setLanguage,
    setUseAlphabet,
    setUseSymbols
  } = settingsActions;

  return (
    <div className="space-y-6">
      <div className="p-5 border border-gray-300 rounded-md bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-4 flex items-center">
          <span>全局設定選項</span>
          <span className="ml-2 text-xs font-normal text-gray-500">系統當前設置將應用於所有工具</span>
        </h2>
        
        <div className="rounded-md bg-gray-50 border border-gray-300 p-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3 text-gray-700 flex items-center">
              <Globe className="w-4 h-4 mr-1 text-gray-500" />
              地區和語言設置
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="settings-region" className="font-medium flex items-center">
                  地區
                  <span className="ml-2 text-xs text-gray-500">({region})</span>
                </Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="settings-region" className="w-full border border-gray-300 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 data-[placeholder]:text-gray-500">
                    <SelectValue placeholder="選擇地區" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 max-h-[300px]">
                    {Object.keys(regions).length > 0 ? (
                      Object.entries(regions).map(([code, name]) => (
                        <SelectItem key={code} value={code} className="hover:bg-gray-100">{name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>加載中...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="settings-language" className="font-medium flex items-center">
                  語言
                  <span className="ml-2 text-xs text-gray-500">({language})</span>
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="settings-language" className="w-full border border-gray-300 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 data-[placeholder]:text-gray-500">
                    <SelectValue placeholder="選擇語言" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-300 max-h-[300px]">
                    {Object.keys(languages).length > 0 ? (
                      Object.entries(languages).map(([code, name]) => (
                        <SelectItem key={code} value={code} className="hover:bg-gray-100">{name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>加載中...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-md font-medium text-gray-700 mb-3">關鍵詞建議選項</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="settingsUseAlphabet" 
                  checked={useAlphabet}
                  onCheckedChange={setUseAlphabet}
                  className="data-[state=checked]:bg-blue-500 border-gray-300"
                />
                <Label htmlFor="settingsUseAlphabet" className="text-sm text-gray-700 cursor-pointer">
                  包含字母 (用於關鍵詞建議)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="settingsUseSymbols" 
                  checked={useSymbols}
                  onCheckedChange={setUseSymbols}
                  className="data-[state=checked]:bg-blue-500 border-gray-300"
                />
                <Label htmlFor="settingsUseSymbols" className="text-sm text-gray-700 cursor-pointer">
                  包含符號 (用於關鍵詞建議)
                </Label>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium mb-3 text-gray-700">搜索結果設置</h3>
            
            <div className="flex items-center justify-between p-2 border-b border-gray-200 pb-3">
              <div>
                <h4 className="font-medium">過濾零搜索量關鍵詞</h4>
                <p className="text-sm text-gray-600">自動過濾沒有搜索量的關鍵詞</p>
              </div>
              <Checkbox 
                id="filter-zero"
                checked={filterZeroVolume}
                onCheckedChange={(checked) => setFilterZeroVolume(checked as boolean)}
                className="data-[state=checked]:bg-blue-500"
              />
            </div>
            
            <div className="space-y-2 pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <Label htmlFor="max-results" className="font-medium">最大結果數</Label>
                  <p className="text-xs text-gray-600 mt-1">限制獲取搜索量時使用的關鍵詞數量，數量越多API消耗越大</p>
                </div>
                <span className="text-sm text-gray-600 bg-blue-50 px-2 py-0.5 rounded-full">{maxResults} 個關鍵詞</span>
              </div>
              <Input
                id="max-results"
                type="range" 
                min="5" 
                max="100" 
                step="5"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
                className="cursor-pointer w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>5</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 