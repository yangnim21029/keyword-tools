'use client'; // Keep client directive if it uses client-only features indirectly or might in future

import { getPageContent } from '@/app/services/firebase/content_storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EnhancedOrganicResult } from '@/lib/schemas';
import { CheckCircle, Eye, XCircle } from 'lucide-react';
import { useState } from 'react';

interface SearchResultItemProps {
  item: EnhancedOrganicResult;
  index: number;
  showHtmlAnalysis?: boolean;
}

export function SearchResultItem({ item, index, showHtmlAnalysis = false }: SearchResultItemProps) {
  const { title, url, displayedUrl, description, position, siteLinks = [], emphasizedKeywords = [], htmlAnalysis } = item;
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Determine display URL safely
  const displayUrlText = displayedUrl || url?.split('//')[1]?.split('/')[0] || url;

  // 處理 Markdown 內容獲取
  const handleViewMarkdown = async () => {
    if (!htmlAnalysis?.contentRef) return;
    
    setIsLoading(true);
    try {
      const content = await getPageContent(htmlAnalysis.contentRef);
      if (content) {
        setMarkdownContent(content.markdown);
        setDialogOpen(true);
      } else {
        console.error('無法獲取 Markdown 內容');
        // 可以在這裡添加一個 toast 提示
      }
    } catch (error) {
      console.error('獲取 Markdown 內容失敗:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-transparent py-3 px-1 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors duration-150 rounded-md group">
      <div className="flex items-start space-x-3">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-400 w-5 text-right pt-1">{index}.</span>
        <div className="flex-1">
          <a href={url} target="_blank" rel="noopener noreferrer" className="block group-hover:underline text-blue-700 dark:text-blue-400 visited:text-purple-600 dark:visited:text-purple-400">
            <h4 className="text-base md:text-lg font-medium truncate text-black dark:text-gray-100">{title || '無標題'}</h4>
            <p className="text-xs text-green-700 dark:text-green-500 truncate mt-0.5">{displayUrlText}</p>
          </a>
          
          <p className="text-sm text-gray-800 dark:text-gray-400 mt-1.5 line-clamp-2">{description || '無描述'}</p>

          {emphasizedKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {emphasizedKeywords.map((keyword, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs text-gray-800 dark:text-gray-300">{keyword}</Badge>
              ))}
            </div>
          )}
          
          {showHtmlAnalysis && htmlAnalysis != null && (
            <div className="mt-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <h5 className="text-xs font-medium text-gray-800 dark:text-gray-300 mb-2">HTML 分析結果</h5>
              <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-400">
                <div className="flex items-center text-gray-800 dark:text-gray-300">
                  {htmlAnalysis.h1Consistency ? 
                    <CheckCircle className="h-3.5 w-3.5 text-green-700 dark:text-green-400 mr-1.5" /> : 
                    <XCircle className="h-3.5 w-3.5 text-red-700 dark:text-red-400 mr-1.5" />
                  }
                  H1 一致性: {htmlAnalysis.h1Consistency ? '是' : '否'}
                </div>
                
                {htmlAnalysis.contentRef && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-1 text-xs text-gray-800 dark:text-gray-300" 
                    onClick={handleViewMarkdown}
                    disabled={isLoading}
                  >
                    <Eye className="h-3 w-3 mr-1" /> 
                    {isLoading ? '加載中...' : '查看 Markdown'}
                  </Button>
                )}
                
                {htmlAnalysis.headings && htmlAnalysis.headings.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-300 mt-1">標題結構:</p>
                    <ul className="list-none pl-3 mt-1 space-y-0.5">
                      {htmlAnalysis.headings.map((heading: { level: string; text: string }, hIdx: number) => (
                        <li key={hIdx} className={`flex items-start ${heading.level === 'h1' ? 'font-semibold' : heading.level === 'h2' ? 'font-medium' : ''}`}>
                           <Badge variant="outline" className="mr-2 mt-0.5 text-gray-600 dark:text-gray-400 px-1.5 py-0 text-[10px] font-mono">{heading.level.toUpperCase()}</Badge>
                           <span className="flex-1 text-gray-800 dark:text-gray-300">{heading.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Markdown 內容對話框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">{title || url}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-300">
            {markdownContent || '沒有內容可顯示'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 