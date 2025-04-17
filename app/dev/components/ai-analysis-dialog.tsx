'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { triggerAiAnalysisForTheme, type GscAnalysisText } from '../gsc-action'
import { Loader2 } from "lucide-react"

type AiAnalysisDialogProps = {
  theme: string; 
}

export function AiAnalysisDialog({ theme }: AiAnalysisDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysisResult, setCurrentAnalysisResult] = useState<GscAnalysisText | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalysisClick = async () => {
    if (isLoading) return;
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setCurrentAnalysisResult(null);
    try {
      const result = await triggerAiAnalysisForTheme(theme);
      setCurrentAnalysisResult(result);
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setError(err instanceof Error ? err.message : "發生未知錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !isLoading) {
      setCurrentAnalysisResult(null);
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          onClick={handleAnalysisClick} 
          disabled={isLoading}
          title={isLoading ? '分析生成中...' : '查看 AI 分析'}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          )}
          {isLoading ? '分析中...' : '查看 AI 分析'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>AI 流量來源優化分析</DialogTitle>
          <DialogDescription>
            {isLoading ? '正在呼叫 AI 分析模型...' : error ? '分析時發生錯誤' : currentAnalysisResult ? '根據當前數據，由 AI 生成的分析文本。' : '點擊「查看 AI 分析」按鈕以觸發分析。'}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm mt-4 max-h-[60vh] overflow-y-auto p-1">
          {isLoading && (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          )}
          {error && (
            <div className="text-red-600 bg-red-50 p-3 rounded-md">
              <p className="font-medium">錯誤:</p>
              <pre className="whitespace-pre-wrap font-sans text-sm mt-1">{error}</pre>
            </div>
          )}
          {!isLoading && !error && currentAnalysisResult && currentAnalysisResult.analysisText && (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {currentAnalysisResult.analysisText}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 