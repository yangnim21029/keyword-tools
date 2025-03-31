import { fetchKeywordResearchList } from "@/app/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KeywordResearchItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { BarChart2, Clock, FileText } from "lucide-react";
import Link from "next/link";
import DeleteResearchButton from "./delete-research-button";
import SearchResearchInput from "./search-research-input";

async function getResearchList(): Promise<KeywordResearchItem[]> {
  const result = await fetchKeywordResearchList(50);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

export default async function KeywordResearchSidebar() {
  const researchList = await getResearchList();

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <SearchResearchInput />
      </div>

      {/* 研究列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {researchList.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              還沒有研究記錄
            </div>
          ) : (
            researchList.map((item: KeywordResearchItem) => (
              <Link
                key={item.id}
                href={`/keyword-research/${item.id}`}
                className={cn(
                  "block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors group"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {item.mainKeyword}
                  </h3>
                  <DeleteResearchButton id={item.id} />
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span className="flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    {formatDistanceToNow(new Date(item.timestamp), { 
                      addSuffix: true,
                      locale: zhTW 
                    })}
                  </span>
                  <span className="flex items-center">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    {item.suggestionCount} 個關鍵詞
                  </span>
                  {item.clustersCount > 0 && (
                    <span className="flex items-center text-blue-500 dark:text-blue-400">
                      <BarChart2 className="h-3.5 w-3.5 mr-1" />
                      {item.clustersCount} 個分群
                    </span>
                  )}
                </div>

                {item.suggestionsPreview.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.suggestionsPreview.map((keyword: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                      >
                        {keyword}
                      </span>
                    ))}
                    {item.suggestionCount > item.suggestionsPreview.length && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        +{item.suggestionCount - item.suggestionsPreview.length}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 